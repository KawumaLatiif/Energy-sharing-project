import random
import uuid
from django.forms import ValidationError
import requests
import logging
from django.conf import settings
from django.http import JsonResponse
from meter.models import Meter, MeterToken
from accounts.models import User
from mtn_momo.services import MTNMoMoService
from transactions.models import UnitTransaction
from .serializers import SendUnitSerializer, TokenSerializer
from ..models import generate_random_string
from rest_framework.generics import (
    CreateAPIView,
    GenericAPIView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from utils.models import UnitReceiverResponse
from rest_framework import generics, permissions
from .serializers import MeterSerializer
from meter.models import Meter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import time
import threading
from transactions.models import Transaction, UnitTransaction
from accounts.models import Wallet
import time
import threading
from django.db import transaction as db_transaction

base_url = settings.BASE_URL

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_user_meter(request):
    try:
        meter = Meter.objects.get(user=request.user)
        return Response({
            'has_meter': True,
            'meter_number': meter.meter_no,
            'static_ip': meter.static_ip
        })
    except Meter.DoesNotExist:
        return Response({
            'has_meter': False
        }, status=status.HTTP_404_NOT_FOUND)

class MeterRegisterView(generics.CreateAPIView):
    serializer_class = MeterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        try:
            # Check if user already has a meter
            if Meter.objects.filter(user=request.user).exists():
                return Response(
                    {"error": "You already have a registered meter."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # Save with user
            meter = serializer.save(user=request.user)
            
            return Response({
                "success": "Meter registered successfully",
                "data": MeterSerializer(meter).data
            }, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Meter registration error: {str(e)}")
            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SendUnitsView(GenericAPIView):

    permission_classes = (IsAuthenticated,)
    serializer_class = SendUnitSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        receiver_meter_no = request.data.get("receiver_meter_no")
        user = request.user

        try:
            sender_meter = Meter.objects.get(user=user)
            receiver_meter = Meter.objects.get(meter_no=receiver_meter_no)
            if receiver_meter and sender_meter:
                units_to_send = request.data.get('no_units') 
                user_message = request.data.get('message')
                receiver_meter_no = request.data.get("receiver_meter_no")
                if not units_to_send:
                    message = (
                        "Invalid units value"
                    )
                    response_data = {
                        "message": message,
                    }
                    return Response(response_data, status=status.HTTP_400_BAD_REQUEST)

                units_to_send = int(units_to_send)
                
                # Ensure there are enough units in the system
                if sender_meter.units < units_to_send or sender_meter.units == 0:
                    message = (
                        "You don't have enough units"
                    )
                    response_data = {
                        "error": message,
                    }
                    return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
                
                sender_transaction = UnitTransaction.objects.create(
                    sender=user,
                    transaction_id=generate_random_string(16),
                    receiver=receiver_meter.user,
                    units=units_to_send,
                    direction="Out",
                    meter=receiver_meter,
                    message=user_message

                )

                print("here")
                # Prepare data to send to the ESP32 meter
                payload = {"units": units_to_send}
                url = f"http://192.168.43.70/process"  # ESP32 meter endpoint

                # Send HTTP request to the ESP32
                response = requests.post(url, json=payload, timeout=5)
                print(response)

                if response:                    # Update the units in the database
                    print("running")
                    sender_meter.units -= units_to_send
                    sender_meter.save()
                    receiver_meter.units += units_to_send
                    receiver_meter.save()
                    print(sender_transaction.status)
                    sender_transaction.status = "COMPLETED"
                    sender_transaction.save()
                    print(sender_transaction.status)

                    message = (
                        "Units sent succesfully"
                    )
                    response_data = {
                        "message": message,
                    }
                    return Response(response_data, status=status.HTTP_200_OK)
                else:
                    sender_transaction.status = "FAILED"
                    sender_transaction.save()
                    message = (
                        "Failed to send units"
                    )
                    response_data = {
                        "error": message,
                    }
                    return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
            else:
                message = (
                        "Either sender meter or receiver meter does not exist"
                )
                response_data = {
                        "error": message,
                }
                return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        except Meter.DoesNotExist:
            message = (
                "Meter not found"
            )
            response_data = {
                "error": message,
            }
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        except requests.exceptions.RequestException as e:
      
            response_data = {
                "error": str(e),
            }
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)


class ReceiveUnitsView(APIView):


    def post(self, request, *args, **kwargs):
        meter_info = request.data
        logger.info(
            f"Receiver function called"
        )

        data = UnitReceiverResponse(**meter_info)
        receiver_meter_no = data.receiver_meter_no
        sender_meter_no = data.sender_meter_no
        no_units = data.units
        user_message = "from emorut"

        print(f"{receiver_meter_no}")
        print(f"{sender_meter_no}")
        print(f"{no_units}")

        try:
            receiver_meter = Meter.objects.get(meter_no=receiver_meter_no)
            sender_meter = Meter.objects.get(meter_no=sender_meter_no)
            
            if receiver_meter and sender_meter:
                units_to_send = no_units # Units to add

                if units_to_send == 0:
                    message = (
                        "Unit can not be 0"
                    )
                    response_data = {
                        "message": message,
                    }
                    return Response(response_data, status=status.HTTP_400_BAD_REQUEST)

                if not units_to_send:
                    message = (
                        "Invalid units value"
                    )
                    response_data = {
                        "message": message,
                    }
                    return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
                
                units_to_receive = int(units_to_send)
                
                # Ensure there are enough units in the system
                if sender_meter.units < units_to_receive:
                    message = (
                        "You don't have enough units"
                    )
                    response_data = {
                        "error": message,
                    }
                    return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
                
                sender_transaction = UnitTransaction.objects.create(
                    sender=sender_meter.user,
                    transaction_id=generate_random_string(16),
                    receiver=receiver_meter.user,
                    units=units_to_send,
                    direction="In",
                    meter=receiver_meter,
                    message=user_message

                )


                # # Prepare data to send to the ESP32 meter
                payload = {"units": units_to_send}
                url = f"http://{receiver_meter.static_ip}/process"
                # Send HTTP request to the ESP32
                response = requests.post(url, json=payload, timeout=5) 

                if response.status_code == 200:
                    # Update the units in the database
                    sender_meter.units -= units_to_send
                    sender_meter.save()
                    receiver_meter.units += units_to_send
                    receiver_meter.save()
                    print("subtracted units")
                    sender_transaction.status = "COMPLETED"
                    sender_transaction.save()

                    message = (
                        "success"
                    )
                    response_data = {
                        "status": message,
                    }
                    return Response(response_data, status=status.HTTP_200_OK)
                else:
                    sender_transaction.status = "FAILED"
                    sender_transaction.save()
                    message = (
                        "Failed to send units"
                    )
                    response_data = {
                        "error": message,
                    }
                    return Response(response_data, status=status.HTTP_400_BAD_REQUEST) 
                
            else:
                message = (
                        "Either sender meter or receiver meter does not exist"
                )
                response_data = {
                        "error": message,
                }
                return Response(response_data, status=status.HTTP_400_BAD_REQUEST)  
        except Meter.DoesNotExist:
            message = (
                "Meter not found"
            )
            response_data = {
                "error": message,
            }
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        

class TokenView(GenericAPIView):

    permission_classes = (IsAuthenticated,)
    serializer_class = TokenSerializer
    def get(self, request, *args, **kwargs):
        user = request.user
        

        try:
            # Filter tokens by user's meter
            user_meter = Meter.objects.get(user=user)
            token_data = MeterToken.objects.filter(meter=user_meter).order_by('-id')[:10]
            
            serializer = self.serializer_class(token_data, many=True)
            
            response_data = {
            "data": serializer.data
            
            }
            return Response(response_data, status=status.HTTP_200_OK)
        except Meter.DoesNotExist:
            return Response({
                "data": {
                    "data": []
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching tokens: {str(e)}")
            return Response({
                "error": "Failed to fetch tokens"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
   
  
   
class BuyUnitsView(GenericAPIView):
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, *args, **kwargs):
        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number")
        
        if not amount or not phone_number:
            return Response({
                "error": "Amount and phone number are required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = request.user
            amount = int(amount)
            
            try:
                meter = Meter.objects.get(user=user)
            except Meter.DoesNotExist:
                return Response({
                    "error": "No meter found. Please register your meter before purchasing units."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if settings.MTN_MOMO_CONFIG.get('ENVIRONMENT', 'sandbox') == 'sandbox':
                # Generate external ID for tracking
                external_id = str(uuid.uuid4())
                
                # Create pending transaction
                transaction = Transaction.objects.create(
                    wallet=user.wallet,
                    amount=amount,
                    phone_number=phone_number,
                    status='PENDING',
                    transaction_reference=external_id,
                    message=f"Buy units - {amount} UGX"
                )
                
                # Return pending response immediately
                response_data = {
                    "status": "PENDING",
                    "message": "Simulating sandbox payment - Please wait...",
                    "external_id": external_id,
                    "transaction_id": transaction.id,
                    "user_prompt": "Sandbox mode: Payment will auto-complete in 2 seconds"
                }
                
                threading.Thread(
                    target=self._simulate_sandbox_payment,
                    args=(user.id, amount, transaction.id, meter.id), 
                    daemon=True
                ).start()
                
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                # Production code with real MoMo integration
                pass
                
        except Exception as e:
            logger.error(f"Buy units error: {str(e)}")
            return Response({
                "error": "Failed to process buy units request"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _simulate_sandbox_payment(self, user_id, amount, transaction_id, meter_id):
        """Simulate successful payment in sandbox mode after 2 seconds"""
        logger.info(f"Sandbox: Starting payment simulation for user {user_id}")
        time.sleep(10)

        try:
            user = User.objects.get(id=user_id)
        
            meter = Meter.objects.get(id=meter_id)

            with db_transaction.atomic():
                units_purchased = amount * 0.1

                # Add units to meter
                meter.units += units_purchased
                meter.save()

                # Update wallet balance
                wallet = user.wallet
                wallet.balance += amount
                wallet.save()

                # Update transaction status
                transaction = Transaction.objects.get(id=transaction_id)
                transaction.status = 'COMPLETED'
                transaction.save()

                # Create UnitTransaction record
                unit_transaction = UnitTransaction.objects.create(
                    sender=user,
                    receiver=user,
                    units=units_purchased,
                    meter=meter,
                    direction="IN",
                    status="COMPLETED",
                    message=f"Purchased {units_purchased} units via sandbox payment"
                )
        
                meter_token = MeterToken.objects.create(
                    meter=meter, 
                    user=user,   
                    token=str(random.randint(1000000000, 9999999999)),
                    units=units_purchased,
                    source="PURCHASE",
                    is_used=False
                )
        
                logger.info(f"Created MeterToken: {meter_token.id} for meter: {meter.meter_no}")

            logger.info(f"Sandbox: Successfully added {units_purchased} units to user {user_id}")

        except Meter.DoesNotExist:
            logger.error(f"No meter found with ID {meter_id} for user {user_id}")
            try:
                transaction = Transaction.objects.get(id=transaction_id)
                transaction.status = 'FAILED'
                transaction.save()
            except:
                pass
        except Exception as e:
            logger.error(f"Sandbox payment simulation error: {str(e)}")
            try:
                transaction = Transaction.objects.get(id=transaction_id)
                transaction.status = 'FAILED'
                transaction.save()
            except:
                pass
    
    
    
class CheckPaymentStatusView(GenericAPIView):
    permission_classes = (IsAuthenticated,)
    
    def post(self, request, *args, **kwargs):
        transaction_id = request.data.get("transaction_id")
        
        if not transaction_id:
            return Response({
                "error": "Transaction ID is required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            transaction = Transaction.objects.get(
                id=transaction_id,
                wallet__user=request.user
            )
            
            if transaction.status == 'COMPLETED':
                meter_token = MeterToken.objects.filter(
                    user=request.user,
                    source="PURCHASE"
                ).select_related('meter').latest('created_at')
                
                return Response({
                    "status": "SUCCESS",
                    "message": "Payment completed successfully",
                    "units_purchased": meter_token.units,
                    "meter_number": meter_token.meter.meter_no,  
                    "token": meter_token.token,
                    "transaction": {
                        "id": transaction.id,
                        "amount": float(transaction.amount),
                        "units": meter_token.units,
                        "timestamp": transaction.created_at.isoformat()
                    }
                }, status=status.HTTP_200_OK)
                
            elif transaction.status == 'FAILED':
                return Response({
                    "status": "FAILED",
                    "message": "Payment failed"
                }, status=status.HTTP_400_BAD_REQUEST)
                
            else:
                return Response({
                    "status": "PENDING",
                    "message": "Payment still processing"
                }, status=status.HTTP_200_OK)
                
        except Transaction.DoesNotExist:
            return Response({
                "error": "Transaction not found"
            }, status=status.HTTP_404_NOT_FOUND)
            
                   
  
            