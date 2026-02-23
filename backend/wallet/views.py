from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction
from decimal import Decimal
import logging
from datetime import datetime

from .models import Wallet, Transaction, MeterBalance
from .serializers import (
    WalletSerializer, 
    TransactionSerializer,
    MeterBalanceSerializer,
)
from accounts.models import User
from meter.models import Meter

logger = logging.getLogger(__name__)

class WalletBalanceView(APIView):
    """
    Returns the user's wallet balance + all associated meter balances.
    Synchronizes MeterBalance records from Meter.units on every request
    to ensure consistency (Meter.units is considered the source of truth
    for energy units).
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        try:
            # Get or auto-create wallet
            wallet, created = Wallet.objects.get_or_create(user=user)
            if created:
                logger.info(f"Auto-created wallet for user {user.username}")

            wallet_data = WalletSerializer(wallet).data
            
            # ────────────────────────────────────────────────
            # Step 1: Sync all user's Meter → MeterBalance
            # ────────────────────────────────────────────────
            with db_transaction.atomic():
                user_meters = Meter.objects.filter(user=user)
                
                for meter in user_meters:
                    MeterBalance.objects.update_or_create(
                        user=user,
                        meter_number=meter.meter_no,
                        defaults={
                            'meter': meter,               # if you added OneToOneField
                            'balance': meter.units,       # sync from source of truth
                            'is_active': True             # or use meter.is_active if exists
                        }
                    )
                
                # Optional: Clean up orphaned MeterBalance records
                # (meters that no longer exist for this user)
                existing_meter_nos = {m.meter_no for m in user_meters}
                MeterBalance.objects.filter(user=user).exclude(
                    meter_number__in=existing_meter_nos
                ).update(is_active=False)
            
            # ────────────────────────────────────────────────
            # Step 2: Fetch fresh MeterBalance records
            # ────────────────────────────────────────────────
            meter_balances = MeterBalance.objects.filter(
                user=user,
                is_active=True
            ).select_related('meter')  # if you added the FK
            
            meter_data = MeterBalanceSerializer(meter_balances, many=True).data
            
            # ────────────────────────────────────────────────
            # Step 3: Recent wallet transactions
            # ────────────────────────────────────────────────
            recent_transactions = Transaction.objects.filter(
                wallet=wallet
            ).order_by('-created_at')[:10]
            
            transactions_data = TransactionSerializer(recent_transactions, many=True).data
            
            # ────────────────────────────────────────────────
            # Optional: Calculate total energy units across meters
            # (useful for dashboard display)
            # ────────────────────────────────────────────────
            total_meter_units = sum(
                Decimal(str(mb.balance)) for mb in meter_balances
            ) if meter_balances.exists() else Decimal('0.00')
            
            # Prepare response
            response_data = {
                "success": True,
                "wallet": wallet_data,
                "meters": meter_data,
                "recent_transactions": transactions_data,
                "wallet_balance": str(wallet.balance),           # monetary / purchase balance
                "total_meter_units": str(total_meter_units),     # total energy units across meters
                "meter_count": meter_balances.count(),
                "timestamp": datetime.now().isoformat(),
            }
            
            if meter_balances.exists():
                # Show primary/active meter if there's one obvious choice
                primary_meter = meter_balances.first()
                response_data["primary_meter"] = {
                    "meter_number": primary_meter.meter_number,
                    "balance": str(primary_meter.balance),
                    "is_active": primary_meter.is_active
                }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in WalletBalanceView for user {user.username}: {str(e)}", exc_info=True)
            return Response({
                "success": False,
                "error": "Failed to retrieve balance information. Please try again later."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class TransactionHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        try:
            wallet, _ = Wallet.objects.get_or_create(user=user)
            
            # Get query parameters for filtering
            transaction_type = request.GET.get('type')
            start_date = request.GET.get('start_date')
            end_date = request.GET.get('end_date')
            limit = int(request.GET.get('limit', 50))
            
            transactions = Transaction.objects.filter(wallet=wallet)
            
            # Apply filters
            if transaction_type:
                transactions = transactions.filter(transaction_type=transaction_type)
            
            if start_date:
                transactions = transactions.filter(created_at__gte=start_date)
            
            if end_date:
                transactions = transactions.filter(created_at__lte=end_date)
            
            transactions = transactions.order_by('-created_at')[:limit]
            
            data = TransactionSerializer(transactions, many=True).data
            
            return Response({
                "success": True,
                "count": len(data),
                "transactions": data,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error fetching transaction history: {str(e)}")
            return Response({
                "error": "An error occurred while fetching transaction history",
                "success": False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CreateWalletView(APIView):
    """Create wallet for existing users who don't have one"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        
        try:
            # Check if wallet already exists
            if hasattr(user, 'mainwallet'):
                return Response({
                    "error": "Wallet already exists for this user",
                    "success": False
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create wallet
            wallet = Wallet.objects.create(user=user)
            
            # Initialize meter balance if user has a meter
            if hasattr(user, 'meter') and user.meter:
                MeterBalance.objects.create(
                    user=user,
                    meter_number=user.meter.meter_number,
                    balance=Decimal('0.00'),
                    is_active=True
                )
            
            wallet_data = WalletSerializer(wallet).data
            
            return Response({
                "success": True,
                "message": "Wallet created successfully",
                "wallet": wallet_data,
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating wallet: {str(e)}")
            return Response({
                "error": "An error occurred while creating wallet",
                "success": False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
