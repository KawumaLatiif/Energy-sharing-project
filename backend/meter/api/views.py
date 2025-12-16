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
            'success': True,
            'data': {
                'has_meter': True,
                'meter_number': meter.meter_no,
                'static_ip': meter.static_ip,
                'units': meter.units
            }
        })
    except Meter.DoesNotExist:
        return Response({
            'success': True,
            'data': {
                'has_meter': False,
                'message': 'No meter registered for this account'
            }
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error checking user meter: {str(e)}")
        return Response({
            'success': False,
            'error': 'Server Error',
            'message': 'Failed to check meter status'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MeterRegisterView(generics.CreateAPIView):
    serializer_class = MeterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        try:
            # Check if user already has a meter
            if Meter.objects.filter(user=request.user).exists():
                return Response(
                    {
                        "success": False,
                        "error": "Meter Already Registered",
                        "message": "You already have a registered meter. Each account can only have one meter."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # Validate IP address format
            static_ip = request.data.get('static_ip')
            if not self._validate_ip_address(static_ip):
                return Response({
                    "success": False,
                    "error": "Invalid IP Address",
                    "message": "Please provide a valid IP address (e.g., 192.168.1.100)"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if meter number already exists
            meter_no = request.data.get('meter_no')
            if Meter.objects.filter(meter_no=meter_no).exists():
                return Response({
                    "success": False,
                    "error": "Duplicate Meter Number",
                    "message": "This meter number is already registered to another account."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Save with user
            meter = serializer.save(user=request.user)
            
            return Response({
                "success": True,
                "message": "Meter registered successfully",
                "data": MeterSerializer(meter).data
            }, status=status.HTTP_201_CREATED)
            
        except ValidationError as e:
            return Response({
                "success": False,
                "error": "Validation Error",
                "message": str(e),
                "details": e.message_dict if hasattr(e, 'message_dict') else None
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Meter registration error: {str(e)}\n{traceback.format_exc()}")
            return Response(
                {
                    "success": False,
                    "error": "Registration Failed",
                    "message": "Failed to register meter. Please try again or contact support."
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _validate_ip_address(self, ip):
        """Validate IP address format"""
        import socket
        try:
            socket.inet_aton(ip)
            return True
        except socket.error:
            return False


class SendUnitsView(GenericAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = SendUnitSerializer

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.serializer_class(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            receiver_meter_no = request.data.get("receiver_meter_no")
            user = request.user
            units_to_send = request.data.get('no_units')
            user_message = request.data.get('message', '')

            # Validate units
            try:
                units_to_send = int(units_to_send)
                if units_to_send <= 0:
                    return Response({
                        "success": False,
                        "error": "Invalid Units",
                        "message": "Number of units must be greater than 0"
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({
                    "success": False,
                    "error": "Invalid Units",
                    "message": "Please enter a valid number of units"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get meters
            try:
                sender_meter = Meter.objects.get(user=user)
                receiver_meter = Meter.objects.get(meter_no=receiver_meter_no)
                
                # Prevent sending to own meter
                if sender_meter.id == receiver_meter.id:
                    return Response({
                        "success": False,
                        "error": "Invalid Operation",
                        "message": "Cannot send units to your own meter"
                    }, status=status.HTTP_400_BAD_REQUEST)
                
            except Meter.DoesNotExist:
                return Response({
                    "success": False,
                    "error": "Meter Not Found",
                    "message": "One or both meters were not found. Please check the meter numbers."
                }, status=status.HTTP_404_NOT_FOUND)

            # Check sender has enough units
            if sender_meter.units < units_to_send:
                return Response({
                    "success": False,
                    "error": "Insufficient Units",
                    "message": f"You only have {sender_meter.units} units available",
                    "available_units": sender_meter.units,
                    "requested_units": units_to_send
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create transaction record
            sender_transaction = UnitTransaction.objects.create(
                sender=user,
                transaction_id=generate_random_string(16),
                receiver=receiver_meter.user,
                units=units_to_send,
                direction="Out",
                meter=receiver_meter,
                message=user_message,
                status="PENDING"
            )

            try:
                # Send request to ESP32 meter
                payload = {"units": units_to_send}
                url = f"http://{receiver_meter.static_ip}/process"
                
                response = requests.post(url, json=payload, timeout=10)
                response.raise_for_status()  # Raise exception for bad status codes
                
                # Update database if ESP32 responds successfully
                with db_transaction.atomic():
                    sender_meter.units -= units_to_send
                    sender_meter.save()
                    
                    receiver_meter.units += units_to_send
                    receiver_meter.save()
                    
                    sender_transaction.status = "COMPLETED"
                    sender_transaction.save()

                return Response({
                    "success": True,
                    "message": f"Successfully sent {units_to_send} units to {receiver_meter_no}",
                    "data": {
                        "transaction_id": sender_transaction.transaction_id,
                        "units_sent": units_to_send,
                        "receiver_meter": receiver_meter_no,
                        "remaining_units": sender_meter.units,
                        "timestamp": sender_transaction.created_at.isoformat()
                    }
                }, status=status.HTTP_200_OK)
                
            except requests.exceptions.Timeout:
                sender_transaction.status = "TIMEOUT"
                sender_transaction.save()
                
                return Response({
                    "success": False,
                    "error": "Connection Timeout",
                    "message": "The meter is not responding. Please try again later.",
                    "transaction_id": sender_transaction.transaction_id
                }, status=status.HTTP_408_REQUEST_TIMEOUT)
                
            except requests.exceptions.ConnectionError:
                sender_transaction.status = "CONNECTION_ERROR"
                sender_transaction.save()
                
                return Response({
                    "success": False,
                    "error": "Connection Failed",
                    "message": "Unable to connect to the meter. Please check the meter's network connection.",
                    "transaction_id": sender_transaction.transaction_id
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                
            except requests.exceptions.RequestException as e:
                sender_transaction.status = "FAILED"
                sender_transaction.save()
                
                logger.error(f"ESP32 request failed: {str(e)}")
                return Response({
                    "success": False,
                    "error": "Transfer Failed",
                    "message": "Failed to send units to the meter. Please try again.",
                    "transaction_id": sender_transaction.transaction_id
                }, status=status.HTTP_502_BAD_GATEWAY)
                
        except Exception as e:
            logger.error(f"Send units error: {str(e)}\n{traceback.format_exc()}")
            return Response({
                "success": False,
                "error": "Server Error",
                "message": "An unexpected error occurred. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            

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
            
                   
  
            