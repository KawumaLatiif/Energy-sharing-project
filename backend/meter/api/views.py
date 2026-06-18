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
from meter.services import push_units_to_thingsboard
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
from accounts.models import Wallet as AccountWallet
from wallet.models import Wallet as UnitWallet
import time
import threading
from django.db import transaction as db_transaction
from loan.models import ElectricityTariff, LoanApplication
from transactions.api.generate_token import generate_numeric_token
import traceback

base_url = settings.BASE_URL

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ami_meter_status(request):
    """
    GET /api/v1/meter/ami-status/?meter_no=...

    Returns connectivity and balance sync status for an AMI meter owned by the user.
    """
    meter_no = request.query_params.get("meter_no")
    if not meter_no:
        return Response({"error": "meter_no is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        meter = Meter.objects.get(user=request.user, meter_no=meter_no)
    except Meter.DoesNotExist:
        return Response(
            {"error": "Meter not found or not owned by you."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if meter.architecture != Meter.ARCH_AMI:
        return Response(
            {"error": "This endpoint is only for AMI meters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from utils.ami_gateway import get_ami_gateway

    gateway_status = get_ami_gateway().get_status(meter)
    unit_wallet = UnitWallet.objects.filter(user=request.user).first()
    wallet_balance = float(unit_wallet.balance) if unit_wallet else 0.0

    if gateway_status is None:
        return Response(
            {
                "success": False,
                "is_online": False,
                "meter_no": meter.meter_no,
                "current_balance_kwh": float(meter.units),
                "wallet_balance": wallet_balance,
                "message": "Meter unreachable.",
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            "success": True,
            "is_online": gateway_status.is_online,
            "last_seen": gateway_status.last_seen,
            "meter_no": gateway_status.meter_no,
            "current_balance_kwh": gateway_status.current_balance_kwh,
            "wallet_balance": wallet_balance,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_user_meter(request):
    try:
        meters = Meter.objects.filter(user=request.user).order_by('create_date')
        if not meters.exists():
            return Response({
                'success': True,
                'data': {
                    'has_meter': False,
                    'message': 'No meter registered for this account'
                }
            }, status=status.HTTP_200_OK)

        meters_list = [
            {
                'meter_number': m.meter_no,
                'static_ip': m.static_ip,
                'units': float(m.units),
                'architecture': m.architecture,
                'pending_units': float(m.pending_units),
                'status': m.status,
                'label': m.label,
            }
            for m in meters
        ]
        primary = meters_list[0]
        return Response({
            'success': True,
            'data': {
                'has_meter': True,
                'meters': meters_list,
                # backward-compat single-meter fields (first registered meter)
                'meter_number': primary['meter_number'],
                'static_ip': primary['static_ip'],
                'units': primary['units'],
                'architecture': primary['architecture'],
                'pending_units': primary['pending_units'],
            }
        })
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
            # Allow one STS and one AMI per user; block duplicate architecture only.
            arch = request.data.get('architecture', Meter.ARCH_STS)
            if Meter.objects.filter(user=request.user, architecture=arch).exists():
                return Response(
                    {
                        "success": False,
                        "error": "Meter Already Registered",
                        "message": f"You already have a registered {arch} meter. Each account can have one STS and one AMI meter."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

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
        meter_no = request.query_params.get("meter_no")

        try:
            if meter_no:
                user_meters = Meter.objects.filter(user=user, meter_no=meter_no)
            else:
                user_meters = Meter.objects.filter(user=user)

            if not user_meters.exists():
                return Response({"data": []}, status=status.HTTP_200_OK)

            token_data = MeterToken.objects.filter(meter__in=user_meters).order_by('-id')[:20]
            serializer = self.serializer_class(token_data, many=True)
            return Response({"data": serializer.data}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching tokens: {str(e)}")
            return Response({"error": "Failed to fetch tokens"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
   
  
   
class ActivateReceivedUnitsView(APIView):
    """
    POST /api/v1/meter/activate-received-units/

    For STS meters: converts pending_units into a MeterToken the user can enter
    on the physical keypad to load the units. Clears pending_units on success.

    For AMI meters: units are already applied — returns 409 with a clear message.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        meter_no = request.data.get("meter_no")

        if meter_no:
            try:
                meter = Meter.objects.get(user=user, meter_no=meter_no)
            except Meter.DoesNotExist:
                return Response({"error": "Meter not found or not owned by you."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            user_meters = Meter.objects.filter(user=user, architecture=Meter.ARCH_STS)
            if not user_meters.exists():
                return Response({"error": "No STS meter registered."}, status=status.HTTP_400_BAD_REQUEST)
            if user_meters.count() > 1:
                return Response(
                    {"error": "You have multiple STS meters. Please specify meter_no."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            meter = user_meters.first()

        if meter.architecture == Meter.ARCH_AMI:
            return Response(
                {"error": "AMI meter — units are applied automatically; no token needed."},
                status=status.HTTP_409_CONFLICT,
            )

        if meter.pending_units <= 0:
            return Response(
                {"error": "No pending units to activate. Buy or receive units first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with db_transaction.atomic():
                units = meter.pending_units
                # Lock the row to prevent double-activation
                locked_meter = Meter.objects.select_for_update().get(pk=meter.pk)
                if locked_meter.pending_units <= 0:
                    return Response(
                        {"error": "Pending units already activated."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                token_value = generate_numeric_token()
                MeterToken.objects.create(
                    user=user,
                    token=token_value,
                    units=units,
                    meter=locked_meter,
                    source='SHARE',
                )
                locked_meter.pending_units = 0
                locked_meter.save(update_fields=['pending_units'])

            return Response(
                {
                    "success": True,
                    "token": token_value,
                    "units": float(units),
                    "message": f"Enter this token on your meter keypad to load {float(units):.2f} kWh.",
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            logger.error("ActivateReceivedUnitsView error: %s", exc, exc_info=True)
            return Response({"error": "Failed to generate token."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GenerateTokenFromWalletView(APIView):
    """
    POST /api/v1/meter/generate-token/

    STS meters: draws `amount` kWh from the user's unit wallet and returns
    a 10-digit token the user enters on the physical meter keypad.
    AMI meters receive balance updates over the network — no token needed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        meter_no = request.data.get("meter_no")

        if meter_no:
            try:
                meter = Meter.objects.get(user=user, meter_no=meter_no)
            except Meter.DoesNotExist:
                return Response({"error": "Meter not found or not owned by you."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            sts_meters = Meter.objects.filter(user=user, architecture=Meter.ARCH_STS)
            if not sts_meters.exists():
                if Meter.objects.filter(user=user, architecture=Meter.ARCH_AMI).exists():
                    return Response(
                        {
                            "error": (
                                "AMI meter — units are applied automatically over the network. "
                                "No token needed."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
                return Response({"error": "No meter registered."}, status=status.HTTP_400_BAD_REQUEST)
            if sts_meters.count() > 1:
                return Response(
                    {"error": "You have multiple STS meters. Please specify meter_no."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            meter = sts_meters.first()

        if meter.architecture == Meter.ARCH_AMI:
            return Response(
                {"error": "AMI meter — units are applied automatically over the network. No token needed."},
                status=status.HTTP_409_CONFLICT,
            )

        raw = request.data.get("amount")
        try:
            amount = Decimal(str(raw))
            if amount <= 0:
                raise ValueError
        except (InvalidOperation, ValueError, TypeError):
            return Response(
                {"error": "Provide a positive numeric kWh amount."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        unit_wallet = UnitWallet.objects.filter(user=user).first()
        if not unit_wallet:
            return Response(
                {"error": "No unit wallet found. Buy units first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if unit_wallet.balance < amount:
            return Response(
                {
                    "error": f"Insufficient wallet balance. Available: {float(unit_wallet.balance):.2f} kWh.",
                    "available": float(unit_wallet.balance),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with db_transaction.atomic():
                locked_wallet = UnitWallet.objects.select_for_update().get(user=user)
                if locked_wallet.balance < amount:
                    return Response(
                        {"error": "Insufficient wallet balance."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                locked_wallet.balance -= amount
                locked_wallet.save(update_fields=["balance"])

                token_value = generate_numeric_token()
                MeterToken.objects.create(
                    user=user,
                    token=token_value,
                    units=amount,
                    meter=meter,
                    source="PURCHASE",
                )

            return Response(
                {
                    "success": True,
                    "token": token_value,
                    "units": float(amount),
                    "remaining_balance": float(locked_wallet.balance),
                    "message": (
                        f"Enter this token on your meter keypad to load {float(amount):.2f} kWh."
                    ),
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            logger.error("GenerateTokenFromWalletView error: %s", exc, exc_info=True)
            return Response(
                {"error": "Failed to generate token."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class BuyUnitsView(GenericAPIView):
    permission_classes = (IsAuthenticated,)

    def _get_active_tariff(self):
        from utils.billing import get_active_domestic_tariff
        return get_active_domestic_tariff()

    def _calculate_units_from_tariff(self, amount, user=None):
        """
        Calculate purchasable kWh from a UGX payment using ERA domestic billing
        (tiered blocks + service charge + 18% VAT).
        """
        from utils.billing import calculate_units_from_payment, get_active_domestic_tariff

        if user is None:
            fallback_rate = Decimal("756.2")
            return (Decimal(str(amount)) / fallback_rate).quantize(Decimal("0.01")), None

        tariff = get_active_domestic_tariff()
        units, breakdown = calculate_units_from_payment(
            Decimal(str(amount)),
            user,
            tariff=tariff,
            apply_deductions=False,
        )
        return units, tariff

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
    
    def post(self, request, *args, **kwargs):
        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number")
        
        if not amount or not phone_number:
            return Response({
                "error": "Amount and phone number are required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = request.user

            # Block purchases when there is any pending or incomplete loan
            active_loans = LoanApplication.objects.filter(
                user=user
            ).exclude(status__in=["COMPLETED", "REJECTED"])
            # Pending/approved/disbursed/defaulted are all considered blocking
            if active_loans.exists():
                return Response({
                    "error": "Loan in progress",
                    "message": "You cannot buy units while you have a pending or incomplete loan. Please clear your loan first."
                }, status=status.HTTP_400_BAD_REQUEST)
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

            _, total_outstanding = self._get_active_loan_balances(user)
            estimated_buy_amount = max(Decimal("0"), amount - total_outstanding)
            estimated_units, tariff = self._calculate_units_from_tariff(estimated_buy_amount, user)
            
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
                    "loan_outstanding_deduction": float(total_outstanding) if total_outstanding > 0 else 0
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
        time.sleep(10)

        try:
            user = User.objects.get(id=user_id)
        
            meter = Meter.objects.get(id=meter_id)

            with db_transaction.atomic():
                amount_decimal = Decimal(str(amount))
                amount_for_units, repaid_to_loans = self._apply_auto_loan_repayment(user, amount_decimal)
                units_purchased, tariff = self._calculate_units_from_tariff(amount_for_units, user)

                # Add purchased/credited units to unit wallet (not meter)
                unit_wallet, _ = UnitWallet.objects.get_or_create(user=user)
                unit_wallet.balance += units_purchased
                unit_wallet.save()

                # Update transaction status
                transaction = Transaction.objects.get(id=transaction_id)
                transaction.status = 'COMPLETED'
                transaction.message = (
                    f"Buy units - {amount_decimal} UGX | Loan repaid: {repaid_to_loans} UGX | "
                    f"Units to wallet: {units_purchased} | Tariff: {tariff.tariff_code if tariff else 'DEFAULT_500'}"
                )

                # Push purchased units to physical meter via ThingsBoard when configured.
                push_ok, push_msg = (True, "Skipped (no units purchased).")
                if units_purchased > 0:
                    push_ok, push_msg = push_units_to_thingsboard(
                        meter=meter,
                        units=units_purchased,
                        reference_id=transaction.transaction_reference,
                    )

                transaction.message = f"{transaction.message} | MeterPush: {'OK' if push_ok else 'FAILED'} ({push_msg})"
                transaction.save()

                # Create UnitTransaction record
                if units_purchased > 0:
                    UnitTransaction.objects.create(
                        sender=user,
                        receiver=user,
                        units=float(units_purchased),
                        meter=None,
                        direction="IN",
                        status="COMPLETED",
                        message=f"Purchased {units_purchased} units to wallet via sandbox payment"
                    )

                    logger.info(
                        f"Units credited to wallet for user {user_id}: {units_purchased} (no token issued)"
                    )
                    if push_ok:
                        logger.info("ThingsBoard push completed for meter %s", meter.meter_no)
                    else:
                        logger.warning("ThingsBoard push not completed for meter %s: %s", meter.meter_no, push_msg)

            logger.info(
                f"Sandbox: Payment complete for user {user_id}. "
                f"Loan repaid={repaid_to_loans}, units_to_wallet={units_purchased}"
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
                unit_tx = UnitTransaction.objects.filter(
                    sender=request.user,
                    receiver=request.user,
                    direction="IN",
                    status="COMPLETED",
                    create_date__gte=transaction.create_date
                ).order_by('-create_date').first()

                units_purchased = float(unit_tx.units) if unit_tx else 0

                return Response({
                    "status": "SUCCESS",
                    "message": "Payment completed successfully",
                    "units_purchased": units_purchased,
                    "token": None,
                    "transaction": {
                        "id": transaction.id,
                        "amount": float(transaction.amount),
                        "units": units_purchased,
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


class MeterPushTestView(APIView):
    """
    Manual utility endpoint to test ThingsBoard unit push.
    This does not change wallet balances; it only pushes telemetry.
    """
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        amount_raw = request.data.get("amount")
        reference_id = str(request.data.get("reference_id", "")).strip() or f"TEST-{uuid.uuid4().hex[:8].upper()}"

        try:
            amount = Decimal(str(amount_raw))
        except (InvalidOperation, TypeError, ValueError):
            return Response({"error": "Invalid amount. Provide a numeric value."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"error": "Amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            meter = Meter.objects.get(user=request.user)
        except Meter.DoesNotExist:
            return Response({"error": "No meter found for this user."}, status=status.HTTP_404_NOT_FOUND)

        ok, msg = push_units_to_thingsboard(meter=meter, units=amount, reference_id=reference_id)
        status_code = status.HTTP_200_OK if ok else status.HTTP_400_BAD_REQUEST

        return Response(
            {
                "success": ok,
                "meter_no": meter.meter_no,
                "amount": float(amount),
                "reference_id": reference_id,
                "message": msg,
            },
            status=status_code,
        )


class AdminMeterPushTestView(APIView):
    """
    Admin-only ThingsBoard push utility that targets any meter by meter_no.
    This does not change wallet balances; it only sends telemetry.
    """
    permission_classes = (permissions.IsAdminUser,)

    def post(self, request, *args, **kwargs):
        meter_no = str(request.data.get("meter_no", "")).strip()
        amount_raw = request.data.get("amount")
        reference_id = str(request.data.get("reference_id", "")).strip() or f"ADMIN-TEST-{uuid.uuid4().hex[:8].upper()}"

        if not meter_no:
            return Response({"error": "meter_no is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_raw))
        except (InvalidOperation, TypeError, ValueError):
            return Response({"error": "Invalid amount. Provide a numeric value."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"error": "Amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            meter = Meter.objects.get(meter_no=meter_no)
        except Meter.DoesNotExist:
            return Response({"error": "Meter not found."}, status=status.HTTP_404_NOT_FOUND)

        ok, msg = push_units_to_thingsboard(meter=meter, units=amount, reference_id=reference_id)
        status_code = status.HTTP_200_OK if ok else status.HTTP_400_BAD_REQUEST

        return Response(
            {
                "success": ok,
                "meter_no": meter.meter_no,
                "amount": float(amount),
                "reference_id": reference_id,
                "message": msg,
            },
            status=status_code,
        )


class EstimateUnitsView(APIView):
    """
    GET /api/v1/meter/estimate-units/?amount=5000

    Returns estimated kWh for a UGX payment using ERA domestic billing
    (tiered blocks + service charge + 18% VAT). No side effects.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw = request.query_params.get("amount", "")
        try:
            amount = Decimal(str(raw))
            if amount <= 0:
                raise ValueError
        except (InvalidOperation, ValueError):
            return Response({"error": "Provide a positive numeric amount."}, status=status.HTTP_400_BAD_REQUEST)

        from utils.billing import (
            calculate_units_from_payment,
            get_active_domestic_tariff,
            get_outstanding_deductions,
        )

        deductions = get_outstanding_deductions(request.user)
        net_amount = max(Decimal("0"), amount - deductions)
        tariff = get_active_domestic_tariff()
        units, breakdown = calculate_units_from_payment(
            amount,
            request.user,
            tariff=tariff,
            outstanding_bills=deductions,
            apply_deductions=False,
        )

        return Response({
            "estimated_units": float(units),
            "tariff": tariff.tariff_code if tariff else None,
            "gross_amount": float(amount),
            "deductions": float(deductions),
            "net_amount": float(net_amount),
            "service_charge": float(breakdown.service_charge),
            "vat": float(breakdown.vat),
            "energy_cost": float(breakdown.energy_cost),
            "total_bill": float(breakdown.total),
        })
