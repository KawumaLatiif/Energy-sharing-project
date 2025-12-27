from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction
from decimal import Decimal
import uuid
from datetime import datetime
import logging

from .serializers import ShareUnitSerializer, TransferUnitsSerializer, VerifyOTPSerializer  # Now all importable
from .models import Share, ShareTransaction
from accounts.models import User
from wallet.models import Wallet, MeterBalance, Transaction
from share.services import VerificationService, VerificationCode
from utils.general import format_currency  # Now exists

logger = logging.getLogger(__name__)

class ShareUnitsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Handle initial share request (step 1: create pending)
        if 'verification_code' not in request.data:
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
                    
                    # Generate transaction ref
                    transaction_ref = f"SHARE-{uuid.uuid4().hex[:8].upper()}"
                    
                    # Store pending in session for verification
                    request.session['pending_share'] = {
                        'receiver_meter_no': receiver_meter_no,
                        'units_to_share': str(units_to_share),
                        'receiver_user': receiver_user.id,
                        'sender_meter': sender_meter.meter_number,
                        'transaction_ref': transaction_ref
                    }
                    request.session.modified = True
                    
                    # Generate verification code
                    verification = VerificationCode.create_code(
                        user=sender,
                        purpose='share_units',
                        expiry_minutes=10
                    )
                    
                    # Prepare transaction details
                    transaction_details = VerificationService.format_transaction_details(
                        'share',
                        sender_username=sender.username,
                        sender_meter=sender_meter.meter_number,
                        receiver_username=receiver_user.username,
                        receiver_meter=receiver_meter.meter_number,
                        units=units_to_share,
                        date=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        transaction_id=transaction_ref
                    )
                    
                    # Send verification email via Celery
                    VerificationService.send_share_verification_email(
                        sender, verification.code, transaction_details
                    )
                    
                    return Response({
                        "success": True,
                        "message": "Verification code sent to your email. Please check and enter the 6-digit code.",
                        "step": "verification"
                    }, status=status.HTTP_200_OK)
                    
            except Exception as e:
                logger.error(f"Error initiating share: {str(e)}")
                return Response({
                    "error": "An error occurred while initiating the share request"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Handle OTP verification and complete share (step 2)
        else:
            otp_serializer = VerifyOTPSerializer(data=request.data)
            if not otp_serializer.is_valid():
                return Response(otp_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            verification_code = otp_serializer.validated_data['verification_code']
            
            # Verify OTP
            pending_share = request.session.get('pending_share')
            if not pending_share:
                return Response({"error": "No pending share found. Please start over."}, status=status.HTTP_400_BAD_REQUEST)
            
            sender = request.user
            if not VerificationCode.verify_code(sender, verification_code, 'share_units'):
                return Response({"error": "Invalid or expired verification code"}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                with db_transaction.atomic():
                    # Retrieve pending data
                    receiver_meter_no = pending_share['receiver_meter_no']
                    units_to_share = Decimal(pending_share['units_to_share'])
                    receiver_user_id = pending_share['receiver_user']
                    transaction_ref = pending_share['transaction_ref']
                    sender_meter_no = pending_share['sender_meter']
                    
                    # Reload objects with locks
                    sender_wallet = Wallet.objects.select_for_update().get(user=sender)
                    receiver_user = User.objects.get(id=receiver_user_id)
                    sender_meter = MeterBalance.objects.select_for_update().get(meter_number=sender_meter_no)
                    receiver_meter = MeterBalance.objects.select_for_update().get(meter_number=receiver_meter_no)
                    
                    # Double-check balance
                    if not sender_wallet.has_sufficient_balance(units_to_share):
                        return Response({"error": "Insufficient balance. Transaction cancelled."}, status=status.HTTP_400_BAD_REQUEST)
                    
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
                    receiver_wallet = Wallet.objects.get(user=receiver_user)
                    receiver_wallet.add(
                        units_to_share,
                        description=f"Received {units_to_share} units from {sender.username}",
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
                        sender=sender,
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
                        message=f"Received {units_to_share} units from {sender.username}",
                        share_transaction_reference=transaction_ref
                    )
                    
                    # Send wallet update emails
                    sender_details = VerificationService.format_transaction_details(
                        'wallet_update',
                        amount=units_to_share,
                        to_username=receiver_user.username,
                        to_meter=receiver_meter.meter_number,
                        new_balance=sender_wallet.balance,
                        transaction_id=transaction_ref,
                        date=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    )
                    
                    receiver_details = VerificationService.format_transaction_details(
                        'wallet_update',
                        amount=units_to_share,
                        from_username=sender.username,
                        from_meter=sender_meter.meter_number,
                        new_balance=receiver_wallet.balance,
                        transaction_id=transaction_ref,
                        date=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    )
                    
                    VerificationService.send_wallet_update_email(sender, sender_details)
                    VerificationService.send_wallet_update_email(receiver_user, receiver_details)
                    
                    # Clear session
                    if 'pending_share' in request.session:
                        del request.session['pending_share']
                    request.session.modified = True
                    
                    logger.info(f"Units shared successfully: {units_to_share} from {sender.username} to {receiver_user.username}")
                    
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

# Added: Missing TransferUnitsView (similar structure, adapted for transfer)
class TransferUnitsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Handle initial transfer request (step 1: create pending)
        if 'verification_code' not in request.data:
            serializer = TransferUnitsSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                with db_transaction.atomic():
                    # Get data
                    old_meter_no = serializer.validated_data['meter_no_old']
                    new_meter_no = serializer.validated_data['meter_no_new']
                    
                    # Get user
                    user = request.user
                    user_wallet = Wallet.objects.select_for_update().get(user=user)
                    
                    # Check if user has units to transfer
                    if user_wallet.balance <= 0:
                        return Response({
                            "error": "No units to transfer"
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Validate old meter exists and is active (belongs to user)
                    try:
                        old_meter = MeterBalance.objects.select_for_update().get(
                            meter_number=old_meter_no,
                            user=user,
                            is_active=True
                        )
                    except MeterBalance.DoesNotExist:
                        return Response(
                            {"error": "Old meter not found or inactive"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    # Validate new meter exists and is active (any user, but different)
                    try:
                        new_meter = MeterBalance.objects.select_for_update().get(
                            meter_number=new_meter_no,
                            is_active=True
                        )
                    except MeterBalance.DoesNotExist:
                        return Response(
                            {"error": "New meter not found or inactive"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    if old_meter == new_meter:
                        return Response(
                            {"error": "Old and new meters must be different"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    # Generate transaction ref
                    transaction_ref = f"TRANSFER-{uuid.uuid4().hex[:8].upper()}"
                    
                    # Store pending in session
                    request.session['pending_transfer'] = {
                        'old_meter_no': old_meter_no,
                        'new_meter_no': new_meter_no,
                        'units_to_transfer': str(user_wallet.balance),  # Transfer all
                        'transaction_ref': transaction_ref
                    }
                    request.session.modified = True
                    
                    # Generate verification code
                    verification = VerificationCode.create_code(
                        user=user,
                        purpose='transfer_units',
                        expiry_minutes=10
                    )
                    
                    # Prepare transaction details
                    transaction_details = VerificationService.format_transaction_details(
                        'transfer',
                        old_meter=old_meter_no,
                        new_meter=new_meter_no,
                        units=user_wallet.balance,
                        username=user.username,
                        date=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        transaction_id=transaction_ref
                    )
                    
                    # Send verification email
                    VerificationService.send_transfer_verification_email(
                        user, verification.code, transaction_details
                    )
                    
                    return Response({
                        "success": True,
                        "message": "Verification code sent to your email. Please check and enter the 6-digit code.",
                        "step": "verification"
                    }, status=status.HTTP_200_OK)
                    
            except Exception as e:
                logger.error(f"Error initiating transfer: {str(e)}")
                return Response({
                    "error": "An error occurred while initiating the transfer request"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Handle OTP verification and complete transfer (step 2)
        else:
            otp_serializer = VerifyOTPSerializer(data=request.data)
            if not otp_serializer.is_valid():
                return Response(otp_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            verification_code = otp_serializer.valid_data['verification_code']
            
            # Verify OTP
            pending_transfer = request.session.get('pending_transfer')
            if not pending_transfer:
                return Response({"error": "No pending transfer found. Please start over."}, status=status.HTTP_400_BAD_REQUEST)
            
            user = request.user
            if not VerificationCode.verify_code(user, verification_code, 'transfer_units'):
                return Response({"error": "Invalid or expired verification code"}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                with db_transaction.atomic():
                    # Retrieve pending data
                    old_meter_no = pending_transfer['old_meter_no']
                    new_meter_no = pending_transfer['new_meter_no']
                    units_to_transfer = Decimal(pending_transfer['units_to_transfer'])
                    transaction_ref = pending_transfer['transaction_ref']
                    
                    # Reload objects
                    user_wallet = Wallet.objects.select_for_update().get(user=user)
                    old_meter = MeterBalance.objects.select_for_update().get(meter_number=old_meter_no)
                    new_meter = MeterBalance.objects.select_for_update().get(meter_number=new_meter_no)
                    
                    # Double-check units
                    if user_wallet.balance < units_to_transfer:
                        return Response({"error": "Insufficient units. Transaction cancelled."}, status=status.HTTP_400_BAD_REQUEST)
                    
                    # Transfer wallet balance
                    user_wallet.deduct(
                        units_to_transfer,
                        description=f"Transferred to new meter {new_meter_no}",
                        transaction_ref=transaction_ref
                    )
                    
                    # Note: Assuming transfer moves to new meter's owner wallet if different user; here simplified to same user
                    # Update meters: Deactivate old, transfer balance to new
                    old_meter.balance = Decimal('0.00')
                    old_meter.is_active = False
                    old_meter.save()
                    
                    old_meter.update_balance(
                        units_to_transfer,
                        operation='deduct',
                        description="Full transfer out - meter deactivated"
                    )
                    
                    new_meter.balance += units_to_transfer
                    new_meter.save()
                    
                    new_meter.update_balance(
                        units_to_transfer,
                        operation='add',
                        description=f"Transferred from {old_meter_no}"
                    )
                    
                    # Create transfer record (use ShareTransaction for simplicity, or add dedicated model)
                    ShareTransaction.objects.create(
                        share_transaction_id=transaction_ref,
                        sender=user,
                        receiver=new_meter.user if new_meter.user != user else user,  # Handle same/different user
                        units=units_to_transfer,
                        meter_send=old_meter,
                        meter_receive=new_meter,
                        status="COMPLETED",
                        message=f"Meter transfer from {old_meter_no} to {new_meter_no} (old deactivated)"
                    )
                    
                    # Send update email
                    update_details = VerificationService.format_transaction_details(
                        'transfer_complete',
                        old_meter=old_meter_no,
                        new_meter=new_meter_no,
                        units=units_to_transfer,
                        new_balance=new_meter.balance,
                        transaction_id=transaction_ref,
                        date=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    )
                    VerificationService.send_wallet_update_email(user, update_details)
                    
                    # Clear session
                    if 'pending_transfer' in request.session:
                        del request.session['pending_transfer']
                    request.session.modified = True
                    
                    logger.info(f"Transfer completed: {units_to_transfer} units from {old_meter_no} to {new_meter_no}")
                    
                    return Response({
                        "success": True,
                        "message": "Transfer completed successfully",
                        "transaction_id": transaction_ref,
                        "units_transferred": str(units_to_transfer),
                        "new_balance": str(new_meter.balance),
                        "old_meter_deactivated": old_meter_no,
                        "timestamp": datetime.now().isoformat()
                    }, status=status.HTTP_200_OK)
                    
            except Exception as e:
                logger.error(f"Error completing transfer: {str(e)}")
                return Response({
                    "error": "An error occurred while completing the transfer"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)