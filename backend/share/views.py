from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from decimal import Decimal
import uuid
from datetime import datetime

from .serializers import ShareUnitSerializer, TransferUnitsSerializer
from .models import Share, ShareTransaction
from accounts.models import User, Wallet
from meter.models import Meter
import logging

logger = logging.getLogger(__name__)

class ShareUnitsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = ShareUnitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # Get data
                receiver_meter_no = serializer.validated_data['meter_number']
                units_to_share = Decimal(serializer.validated_data['units'])
                
                # Get sender (current user)
                sender = request.user
                sender_wallet = Wallet.objects.select_for_update().get(user=sender)
                
                # Check if sender has sufficient units
                if sender_wallet.balance < units_to_share:
                    return Response(
                        {"error": "Insufficient units in your wallet"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Validate receiver meter exists and is active
                try:
                    receiver_meter = Meter.objects.select_for_update().get(
                        meter_number=receiver_meter_no,
                        is_active=True
                    )
                except Meter.DoesNotExist:
                    return Response(
                        {"error": "Receiver meter not found or inactive"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get receiver user
                receiver_user = receiver_meter.user
                receiver_wallet = Wallet.objects.select_for_update().get(user=receiver_user)
                
                # Prevent self-sharing
                if sender == receiver_user:
                    return Response(
                        {"error": "Cannot share units to yourself"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get sender's meter
                sender_meter = Meter.objects.filter(user=sender, is_active=True).first()
                if not sender_meter:
                    return Response(
                        {"error": "No active meter found for sender"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Create share transaction
                share_transaction = ShareTransaction.objects.create(
                    share_transaction_id=f"SHARE-{uuid.uuid4().hex[:8].upper()}",
                    sender=sender,
                    receiver=receiver_user,
                    units=float(units_to_share),
                    meter_send=sender_meter,
                    meter_receive=receiver_meter,
                    direction="OUT" if sender == sender else "IN",
                    status="PENDING",
                    message=f"Unit sharing from {sender_meter.meter_number} to {receiver_meter.meter_number}"
                )
                
                # Deduct from sender's wallet
                sender_wallet.balance -= units_to_share
                sender_wallet.save()
                
                # Add to receiver's wallet
                receiver_wallet.balance += units_to_share
                receiver_wallet.save()
                
                # Update transaction status
                share_transaction.status = "COMPLETED"
                share_transaction.save()
                
                # Create Share record
                Share.objects.create(
                    share_transaction_id=share_transaction.share_transaction_id,
                    wallet=receiver_wallet,
                    units=units_to_share,
                    status="COMPLETED",
                    meter_number=receiver_meter,
                    message=f"Received {units_to_share} units from {sender.username}",
                    share_transaction_reference=share_transaction.share_transaction_id
                )
                
                logger.info(f"Units shared successfully: {units_to_share} from {sender.username} to {receiver_user.username}")
                
                return Response({
                    "message": "Units shared successfully",
                    "transaction_id": share_transaction.share_transaction_id,
                    "units_shared": str(units_to_share),
                    "sender_balance": str(sender_wallet.balance),
                    "receiver_balance": str(receiver_wallet.balance)
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Error sharing units: {str(e)}")
            return Response(
                {"error": "An error occurred while processing your request"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class TransferUnitsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """
        Transfer all units from old meter to new meter when moving regions
        """
        serializer = TransferUnitsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                old_meter_no = serializer.validated_data['meter_no_old']
                new_meter_no = serializer.validated_data['meter_no_new']
                
                # Verify user owns the old meter
                user = request.user
                try:
                    old_meter = Meter.objects.select_for_update().get(
                        meter_number=old_meter_no,
                        user=user,
                        is_active=True
                    )
                except Meter.DoesNotExist:
                    return Response(
                        {"error": "Old meter not found or you don't own it"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Verify new meter exists and is not already assigned
                try:
                    new_meter = Meter.objects.select_for_update().get(
                        meter_number=new_meter_no,
                        is_active=False  # New meter should be inactive initially
                    )
                except Meter.DoesNotExist:
                    return Response(
                        {"error": "New meter not found or already active"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Check if new meter already has an owner
                if new_meter.user and new_meter.user != user:
                    return Response(
                        {"error": "New meter already assigned to another user"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Get user's wallet
                wallet = Wallet.objects.select_for_update().get(user=user)
                units_to_transfer = wallet.balance
                
                if units_to_transfer <= 0:
                    return Response(
                        {"error": "No units to transfer"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Create transfer transaction
                transfer_id = f"TRANSFER-{uuid.uuid4().hex[:8].upper()}"
                
                # Create transaction record
                ShareTransaction.objects.create(
                    share_transaction_id=transfer_id,
                    sender=user,
                    receiver=user,
                    units=float(units_to_transfer),
                    meter_send=old_meter,
                    meter_receive=new_meter,
                    direction="OUT",
                    status="PENDING",
                    message=f"Unit transfer from old meter {old_meter_no} to new meter {new_meter_no}"
                )
                
                # Deactivate old meter
                old_meter.is_active = False
                old_meter.deactivated_at = datetime.now()
                old_meter.save()
                
                # Activate and assign new meter
                new_meter.user = user
                new_meter.is_active = True
                new_meter.activated_at = datetime.now()
                new_meter.save()
                
                # Create transfer record
                Share.objects.create(
                    share_transaction_id=transfer_id,
                    wallet=wallet,
                    units=units_to_transfer,
                    status="COMPLETED",
                    meter_number=new_meter,
                    message=f"Transferred {units_to_transfer} units from {old_meter_no} to {new_meter_no}",
                    share_transaction_reference=transfer_id
                )
                
                logger.info(f"Units transferred successfully: {units_to_transfer} from {old_meter_no} to {new_meter_no}")
                
                return Response({
                    "message": "Units transferred successfully",
                    "transaction_id": transfer_id,
                    "units_transferred": str(units_to_transfer),
                    "old_meter": old_meter_no,
                    "new_meter": new_meter_no,
                    "old_meter_status": "DEACTIVATED",
                    "new_meter_status": "ACTIVE"
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Error transferring units: {str(e)}")
            return Response(
                {"error": "An error occurred while processing your request"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )