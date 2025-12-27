from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction
from decimal import Decimal
import uuid
from datetime import datetime
import logging

from .serializers import ShareUnitSerializer, TransferUnitsSerializer, VerifyOTPSerializer
from .models import Share, ShareTransaction
from accounts.models import User
from wallet.models import Wallet, MeterBalance, Transaction
from share.services import VerificationService, VerificationCode
from utils.general import format_currency

logger = logging.getLogger(__name__)

class ShareUnitsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = ShareUnitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with db_transaction.atomic():
                # Get data
                receiver_meter_no = serializer.validated_data['meter_number']
                units_to_share = Decimal(str(serializer.validated_data['units']))
                
                # Get sender (current user)
                sender = request.user
                sender_wallet = Wallet.objects.select_for_update().get(user=sender)
                
                # Check if sender has sufficient units
                if not sender_wallet.has_sufficient_balance(units_to_share):
                    return Response({
                        "error": f"Insufficient units in your wallet. Your balance: {format_currency(sender_wallet.balance)} units"
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Validate receiver meter exists and is active
                try:
                    receiver_meter = MeterBalance.objects.select_for_update().get(
                        meter_number=receiver_meter_no,
                        is_active=True
                    )
                except MeterBalance.DoesNotExist:
                    return Response(
                        {"error": "Receiver meter not found or inactive"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get receiver user
                receiver_user = receiver_meter.user
                
                # Prevent self-sharing
                if sender == receiver_user:
                    return Response(
                        {"error": "Cannot share units to yourself"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get sender's meter
                sender_meter = MeterBalance.objects.filter(user=sender, is_active=True).first()
                if not sender_meter:
                    return Response(
                        {"error": "No active meter found for sender"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Generate verification code
                verification = VerificationCode.create_code(
                    user=sender,
                    purpose='share_units',
                    expiry_minutes=10
                )
                
                # Prepare transaction details
                transaction_details = f"""
                Sharing Energy Units:
                - From User: {sender.username} ({sender.email})
                - From Meter: {sender_meter.meter_number}
                - To User: {receiver_user.username} ({receiver_user.email})
                - To Meter: {receiver_meter.meter_number}
                - Units: {format_currency(units_to_share)}
                - Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                - Transaction ID: SHARE-{uuid.uuid4().hex[:8].upper()}
                """
                
                # Send verification email via Celery
                VerificationService.send_share_verification_email.delay(
                    sender.id,
                    verification.code,
                    transaction_details
                )
                
                # Store temporary transaction data in session
                request.session['pending_share'] = {
                    'receiver_meter_no': receiver_meter_no,
                    'units_to_share': str(units_to_share),
                    'sender_meter_id': sender_meter.id,
                    'receiver_meter_id': receiver_meter.id,
                    'verification_code_id': verification.id,
                    'transaction_details': transaction_details,
                }
                request.session.modified = True
                
                return Response({
                    "success": True,
                    "message": "Verification code sent to your email",
                    "verification_required": True,
                    "units": str(units_to_share),
                    "receiver_meter": receiver_meter_no,
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Error initiating share: {str(e)}")
            return Response(
                {"error": "An error occurred while processing your request"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class VerifyShareOTPView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        otp_code = serializer.validated_data['otp_code']
        user = request.user
        
        # Verify OTP
        if not VerificationCode.verify_code(user, otp_code, 'share_units'):
            return Response({
                "error": "Invalid or expired verification code"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get pending transaction from session
        pending_share = request.session.get('pending_share')
        if not pending_share:
            return Response({
                "error": "No pending transaction found. Please start a new transaction."
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with db_transaction.atomic():
                # Get data from session
                receiver_meter_no = pending_share['receiver_meter_no']
                units_to_share = Decimal(pending_share['units_to_share'])
                sender_meter_id = pending_share['sender_meter_id']
                receiver_meter_id = pending_share['receiver_meter_id']
                
                # Get wallets and meters
                sender_wallet = Wallet.objects.select_for_update().get(user=user)
                sender_meter = MeterBalance.objects.select_for_update().get(id=sender_meter_id)
                
                receiver_meter = MeterBalance.objects.select_for_update().get(id=receiver_meter_id)
                receiver_user = receiver_meter.user
                receiver_wallet = Wallet.objects.select_for_update().get(user=receiver_user)
                
                # Generate transaction reference
                transaction_ref = f"SHARE-{uuid.uuid4().hex[:8].upper()}"
                
                # Deduct from sender
                sender_wallet.deduct(
                    units_to_share,
                    description=f"Shared {units_to_share} units to {receiver_user.username}",
                    transaction_ref=transaction_ref
                )
                
                sender_meter.update_balance(
                    units_to_share,
                    operation='deduct',
                    description=f"Shared to {receiver_meter.meter_number}"
                )
                
                # Add to receiver
                receiver_wallet.add(
                    units_to_share,
                    description=f"Received {units_to_share} units from {user.username}",
                    transaction_ref=transaction_ref
                )
                
                receiver_meter.update_balance(
                    units_to_share,
                    operation='add',
                    description=f"Received from {sender_meter.meter_number}"
                )
                
                # Create share transaction record
                share_transaction = ShareTransaction.objects.create(
                    share_transaction_id=transaction_ref,
                    sender=user,
                    receiver=receiver_user,
                    units=units_to_share,
                    meter_send=sender_meter,
                    meter_receive=receiver_meter,
                    status="COMPLETED",
                    message=f"Unit sharing from {sender_meter.meter_number} to {receiver_meter.meter_number}"
                )
                
                # Create Share record
                Share.objects.create(
                    share_transaction_id=transaction_ref,
                    wallet=receiver_wallet,
                    units=units_to_share,
                    status="COMPLETED",
                    meter_number=receiver_meter,
                    message=f"Received {units_to_share} units from {user.username}",
                    share_transaction_reference=transaction_ref
                )
                
                # Send wallet update emails
                sender_details = f"""
                Units Shared:
                - Amount: {format_currency(units_to_share)} units
                - To: {receiver_user.username} ({receiver_meter.meter_number})
                - New Balance: {format_currency(sender_wallet.balance)} units
                - Transaction ID: {transaction_ref}
                - Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                """
                
                receiver_details = f"""
                Units Received:
                - Amount: {format_currency(units_to_share)} units
                - From: {user.username} ({sender_meter.meter_number})
                - New Balance: {format_currency(receiver_wallet.balance)} units
                - Transaction ID: {transaction_ref}
                - Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                """
                
                VerificationService.send_wallet_update_email.delay(user.id, sender_details)
                VerificationService.send_wallet_update_email.delay(receiver_user.id, receiver_details)
                
                # Clear session
                del request.session['pending_share']
                request.session.modified = True
                
                logger.info(f"Units shared successfully: {units_to_share} from {user.username} to {receiver_user.username}")
                
                return Response({
                    "success": True,
                    "message": "Units shared successfully",
                    "transaction_id": transaction_ref,
                    "units_shared": str(units_to_share),
                    "sender_balance": str(sender_wallet.balance),
                    "receiver_meter": receiver_meter.meter_number,
                    "timestamp": datetime.now().isoformat()
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Error completing share transaction: {str(e)}")
            return Response({
                "error": "An error occurred while completing the transaction"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)