import random
import uuid
from decimal import Decimal, InvalidOperation
from django.forms import ValidationError
import requests
import logging
import traceback
from django.conf import settings
from django.http import JsonResponse
from meter.models import Meter, MeterToken
from accounts.models import User
from mtn_momo.services import MTNMoMoService
from transactions.models import UnitTransaction, TransactionLog, TransactionType
from .serializers import SendUnitSerializer, TokenSerializer
from ..models import generate_random_string, generate_numeric_token
from rest_framework.generics import (
    CreateAPIView,
    GenericAPIView,
)
from loan.credit_score_service import CreditScoreService
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
from accounts.models import Wallet as AccountWallet
from wallet.models import Wallet as MoneyWallet
import time
import threading
from django.db import transaction as db_transaction
from loan.models import ElectricityTariff, LoanApplication, LoanRepayment
import traceback
from wallet.models import UnitBalance 


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


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_meter(request):
    """
    Update existing meter information
    """
    try:
        user = request.user
        data = request.data
        
        # Get user's meter
        try:
            meter = Meter.objects.get(user=user)
        except Meter.DoesNotExist:
            return Response(
                {"error": "No meter found to update"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validate meter number uniqueness (excluding current meter)
        new_meter_no = data.get('meter_no')
        if new_meter_no and new_meter_no != meter.meter_no:
            if Meter.objects.filter(meter_no=new_meter_no).exclude(id=meter.id).exists():
                return Response({
                    "success": False,
                    "error": "Duplicate Meter Number",
                    "message": "This meter number is already registered to another account."
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Update fields
        serializer = MeterSerializer(meter, data=data, partial=True)
        if serializer.is_valid():
            updated_meter = serializer.save()
            
            logger.info(f"Meter updated for user {user.id}: {updated_meter.meter_no}")
            
            return Response({
                "success": True,
                "message": "Meter updated successfully",
                "data": MeterSerializer(updated_meter).data
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "success": False,
                "error": "Validation Error",
                "message": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Meter update error: {str(e)}")
        return Response({
            "success": False,
            "error": "Update Failed",
            "message": "Failed to update meter. Please try again."
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
    
    def _create_purchase_and_update_balances(self, user, meter, units_purchased, reference_id):
        """
        When user buys units:
        1. Add to UnitBalance (available to share)
        2. Create token (optional loading to meter)
        3. Update credit score
        """
        
        # 1. Add to UnitBalance - units available for sharing
        unit_balance, _ = UnitBalance.objects.get_or_create(user=user)
        unit_balance.add_units(
            units_purchased,
            description=f"Purchased {units_purchased} units via {reference_id}",
            reference=reference_id
        )
        
        # 2. Create token for meter loading
        token_value = generate_numeric_token(10)
        while MeterToken.objects.filter(token=token_value).exists():
            token_value = generate_numeric_token(10)
        
        token = MeterToken.objects.create(
            user=user,
            token=token_value,
            units=units_purchased,
            meter=meter,
            source='PURCHASE',
            is_used=False
        )
        
        # 3. Update credit score for purchase
        CreditScoreService.update_credit_score(
            user=user,
            event_type='UNIT_PURCHASE',
            reference_id=reference_id,
            extra_data={
                'units': float(units_purchased),
                'amount': float(units_purchased * 500),  # Approximate amount
                'payment_source': 'WALLET'
            }
        )
        
        logger.info(
            f"Purchase complete for user {user.email}: "
            f"Added {units_purchased} units to UnitBalance (new balance: {unit_balance.balance}), "
            f"Token {token.token} created"
        )
        
        return token, unit_balance.balance
        
        logger.info(
            f"Purchase complete for user {user.email}: "
            f"Added {units_purchased} units to UnitBalance (new balance: {unit_balance.balance}), "
            f"Token {token.token} created"
        )
        
        return token, unit_balance.balance
    

    def _get_active_tariff(self):
        tariff = ElectricityTariff.objects.filter(
            tariff_code="CODE10.1",
            is_active=True
        ).first()
        if tariff:
            return tariff
        return ElectricityTariff.objects.filter(is_active=True).order_by('-effective_date').first()

    def _calculate_units_from_tariff(self, amount):
        """
        Calculate purchasable units from amount using tariff blocks.
        Falls back to legacy flat rate (500 UGX/unit) if no active tariff exists.
        """
        tariff = self._get_active_tariff()
        fallback_rate = Decimal("500")

        if not tariff:
            return (amount / fallback_rate).quantize(Decimal("0.01")), None

        blocks = tariff.blocks.all().order_by('block_order')
        if not blocks.exists():
            return (amount / fallback_rate).quantize(Decimal("0.01")), tariff

        remaining_amount = Decimal(str(amount))
        total_units = Decimal("0")

        for block in blocks:
            if remaining_amount <= 0:
                break

            rate = Decimal(str(block.rate_per_unit))
            if rate <= 0:
                continue

            if block.max_units is None:
                total_units += remaining_amount / rate
                remaining_amount = Decimal("0")
                break

            block_units_available = Decimal(block.max_units - block.min_units + 1)
            block_cost = block_units_available * rate

            if remaining_amount >= block_cost:
                total_units += block_units_available
                remaining_amount -= block_cost
            else:
                total_units += remaining_amount / rate
                remaining_amount = Decimal("0")
                break

        return total_units.quantize(Decimal("0.01")), tariff

    def _get_active_loan_balances(self, user):
        loans_with_balance = []
        total_outstanding = Decimal("0")
        for loan in LoanApplication.objects.filter(user=user, status='DISBURSED').order_by('created_at'):
            balance = Decimal(str(loan.outstanding_balance))
            if balance > 0:
                loans_with_balance.append((loan, balance))
                total_outstanding += balance
        return loans_with_balance, total_outstanding

    def _apply_auto_loan_repayment(self, user, payment_amount):
        """
        Use incoming purchase payment to clear disbursed loan balances first.
        Returns (remaining_amount_for_units, total_repaid).
        """
        remaining = Decimal(str(payment_amount))
        total_repaid = Decimal("0")
        loans_with_balance, _ = self._get_active_loan_balances(user)

        for loan, outstanding in loans_with_balance:
            if remaining <= 0:
                break

            paid = min(remaining, outstanding)
            LoanRepayment.objects.create(
                loan=loan,
                amount_paid=paid,
                units_paid=0,
                payment_reference=generate_random_string(12),
                is_on_time=True,
                payment_method='MOBILE_MONEY',
                payment_status='SUCCESS'
            )
            remaining -= paid
            total_repaid += paid

            loan.refresh_from_db()
            if loan.outstanding_balance <= 0:
                loan.status = 'COMPLETED'
                loan.save()

        return remaining, total_repaid

    def _create_purchase_token(self, user, meter, units_purchased):
        token_value = generate_random_string(10)
        while MeterToken.objects.filter(token=token_value).exists():
            token_value = generate_random_string(10)

        return MeterToken.objects.create(
            user=user,
            token=token_value,
            units=units_purchased,
            meter=meter,
            source='PURCHASE',
        )

    def _record_purchase_history(self, user, amount, units_purchased, token, meter, payment_source, reference_id):
        TransactionLog.objects.create(
            user=user,
            transaction_type=TransactionType.UNIT_PURCHASE,
            amount=amount,
            units=units_purchased,
            status='COMPLETED',
            reference_id=reference_id,
            details={
                'meter_no': meter.meter_no,
                'token': token.token,
                'payment_source': payment_source,
            },
        )

        UnitTransaction.objects.create(
            sender=user,
            receiver=user,
            units=float(units_purchased),
            meter=meter,
            direction="IN",
            status="COMPLETED",
            message=f"Purchased {units_purchased} units. Token {token.token} issued.",
        )
    
    def post(self, request, *args, **kwargs):
        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number", "")
        payment_source = str(request.data.get("payment_source", "PHONE")).upper()
        
        if not amount:
            return Response({
                "error": "Amount is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        if payment_source not in {"WALLET", "PHONE", "MOBILE_MONEY"}:
            return Response({
                "error": "Payment source must be WALLET or PHONE"
            }, status=status.HTTP_400_BAD_REQUEST)

        if payment_source in {"PHONE", "MOBILE_MONEY"} and not phone_number:
            return Response({
                "error": "Phone number is required for phone payments"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = request.user

            try:
                amount = Decimal(str(amount))
            except (InvalidOperation, TypeError, ValueError):
                return Response({
                    "error": "Amount must be a valid number"
                }, status=status.HTTP_400_BAD_REQUEST)

            if amount <= 0:
                return Response({
                    "error": "Amount must be greater than 0"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                meter = Meter.objects.get(user=user)
            except Meter.DoesNotExist:
                return Response({
                    "error": "No meter found. Please register your meter before purchasing units."
                }, status=status.HTTP_400_BAD_REQUEST)

            account_wallet = AccountWallet.objects.filter(user=user).order_by('-create_date').first()
            if account_wallet is None:
                account_wallet = AccountWallet.objects.create(user=user)

            estimated_units, tariff = self._calculate_units_from_tariff(amount)

            if payment_source == "WALLET":
                with db_transaction.atomic():
                    # Deduct from money wallet
                    money_wallet, _ = MoneyWallet.objects.select_for_update().get_or_create(user=user)
                    if money_wallet.balance < amount:
                        return Response({
                            "error": "Insufficient wallet balance",
                            "wallet_balance": str(money_wallet.balance),
                        }, status=status.HTTP_400_BAD_REQUEST)

                    reference_id = f"PUR-{uuid.uuid4().hex[:8].upper()}"
                    money_wallet.deduct(
                        amount,
                        description=f"Purchased {estimated_units} electricity units",
                        transaction_ref=reference_id,
                    )
                
                    # Create token AND add to UnitBalance
                    token, new_unit_balance = self._create_purchase_and_update_balances(
                        user, meter, estimated_units, reference_id
                    )

                    self._record_purchase_history(
                        user,
                        amount,
                        estimated_units,
                        token,
                        meter,
                        "WALLET",
                        reference_id,
                    )

                    return Response({
                        "status": "SUCCESS",
                        "message": "Units purchased successfully!",
                        "token": token.token,
                        "units_purchased": "{:.2f}".format(estimated_units),
                        "units_available_to_share": "{:.2f}".format(new_unit_balance),
                        "wallet_balance": str(money_wallet.balance),
                        "tariff_applied": tariff.tariff_code if tariff else "DEFAULT_500",
                    }, status=status.HTTP_200_OK)
            
            if settings.MTN_MOMO_CONFIG.get('ENVIRONMENT', 'sandbox') == 'sandbox':
                # Generate external ID for tracking
                external_id = str(uuid.uuid4())
                
                # Create pending transaction
                try:
                    transaction = Transaction.objects.create(
                        wallet=account_wallet,
                        amount=amount,
                        phone_number=phone_number,
                        status='PENDING',
                        transaction_reference=external_id,
                        message=f"Buy units - {amount} UGX"
                    )
                except Exception:
                    return Response({
                        "error": "Invalid phone number. Use full format e.g. +2567XXXXXXXX."
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Return pending response immediately
                response_data = {
                    "status": "PENDING",
                    "message": "Simulating sandbox payment - Please wait...",
                    "external_id": external_id,
                    "transaction_id": transaction.id,
                    "user_prompt": "Sandbox mode: Payment will auto-complete in 2 seconds",
                    "estimated_units": float(estimated_units),
                    "tariff_applied": tariff.tariff_code if tariff else "DEFAULT_500",
                }
                
                threading.Thread(
                    target=self._simulate_sandbox_payment,
                    args=(user.id, str(amount), transaction.id, meter.id),
                    daemon=True
                ).start()
                
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                # Production code with real MoMo integration
                pass
                
        except Exception as e:
            logger.exception(f"Buy units error: {str(e)}")
            return Response({
                "error": "Failed to process buy units request"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _simulate_sandbox_payment(self, user_id, amount, transaction_id, meter_id):
        """Simulate successful payment in sandbox mode after 2 seconds"""
        logger.info(f"Sandbox: Starting payment simulation for user {user_id}")
        time.sleep(2)

        try:
            user = User.objects.get(id=user_id)
        
            meter = Meter.objects.get(id=meter_id)

            with db_transaction.atomic():
                amount_decimal = Decimal(str(amount))
                units_purchased, tariff = self._calculate_units_from_tariff(amount_decimal)

                # Update transaction status
                transaction = Transaction.objects.get(id=transaction_id)
                transaction.status = 'COMPLETED'
                transaction.message = (
                    f"Buy units - {amount_decimal} UGX | Token issued for {units_purchased} units | "
                    f"Tariff: {tariff.tariff_code if tariff else 'DEFAULT_500'}"
                )
                transaction.save()

                if units_purchased > 0:
                    token, new_unit_balance = self._create_purchase_and_update_balances(
                        user, meter, units_purchased, transaction.transaction_reference
                    )
                    
                    self._record_purchase_history(
                        user,
                        amount_decimal,
                        units_purchased,
                        token,
                        meter,
                        "PHONE",
                        transaction.transaction_reference,
                    )

            logger.info(
                f"Sandbox: Payment complete for user {user_id}. "
                f"token_units={units_purchased}"
            )

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
                purchase_log = TransactionLog.objects.filter(
                    user=request.user,
                    transaction_type=TransactionType.UNIT_PURCHASE,
                    reference_id=transaction.transaction_reference,
                    status="COMPLETED",
                ).order_by('-created_at').first()

                details = purchase_log.details if purchase_log and purchase_log.details else {}
                units_purchased = float(purchase_log.units) if purchase_log and purchase_log.units else 0
                token = details.get("token")

                return Response({
                    "status": "SUCCESS",
                    "message": "Payment completed successfully",
                    "units_purchased": units_purchased,
                    "token": token,
                    "transaction": {
                        "id": transaction.id,
                        "amount": float(transaction.amount),
                        "units": units_purchased,
                        "token": token,
                        "timestamp": transaction.create_date.isoformat()
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
        except Exception as e:
            logger.error(f"Check payment status error: {str(e)}")
            return Response({
                "error": "Failed to check payment status"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            


class LoadTokenToMeterView(APIView):
    """
    User loads a token to add units to their physical meter
    Units REMAIN in UnitBalance - user can still share them
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        token_code = request.data.get('token')
        
        if not token_code:
            return Response({
                "error": "Token is required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Ensure token is numeric only
        if not token_code.isdigit():
            return Response({
                "error": "Invalid token format. Token must contain only numbers."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            token = MeterToken.objects.get(
                token=token_code,
                user=request.user,
                is_used=False
            )
        except MeterToken.DoesNotExist:
            return Response({
                "error": "Invalid or already used token"
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get user's meter
        try:
            meter = Meter.objects.get(user=request.user)
        except Meter.DoesNotExist:
            return Response({
                "error": "No meter found. Please register your meter first."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Ensure token belongs to this meter
        if token.meter.id != meter.id:
            return Response({
                "error": "This token is for a different meter"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with db_transaction.atomic():
            # Add units to physical meter
            meter.units += token.units
            meter.save()
            
            # IMPORTANT: Units REMAIN in UnitBalance
            # User can still share these units with others
            # The physical meter reading is just for consumption tracking
            
            # Mark token as used
            token.is_used = True
            token.save()
            
            # Record the meter loading transaction
            try:
                meter_balance = MeterBalance.objects.get(meter=meter)
                MeterTransaction.objects.create(
                    meter=meter_balance,
                    amount=token.units,
                    operation='ADD',
                    balance_after=meter.units,
                    description=f"Loaded token {token.token} from {token.source}",
                    reference=token.token
                )
            except MeterBalance.DoesNotExist:
                # Create meter balance if doesn't exist
                meter_balance = MeterBalance.objects.create(
                    user=request.user,
                    meter=meter,
                    meter_number=meter.meter_no,
                    balance=meter.units
                )
            
            # Get current unit balance
            unit_balance, _ = UnitBalance.objects.get_or_create(user=request.user)
            
            logger.info(
                f"Token {token.token} loaded for user {request.user.email}: "
                f"Added {token.units} units to meter {meter.meter_no}. "
                f"UnitBalance unchanged at {unit_balance.balance} units"
            )
            
            return Response({
                "success": True,
                "message": f"Successfully loaded {token.units} units to your meter",
                "meter_units": float(meter.units),
                "units_available_to_share": float(unit_balance.balance),
                "token_used": token.token,
                "source": token.source
            }, status=status.HTTP_200_OK)