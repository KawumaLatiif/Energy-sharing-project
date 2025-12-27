from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction
from decimal import Decimal
import logging

from .models import Wallet, Transaction, MeterBalance
from .serializers import (
    WalletSerializer, 
    TransactionSerializer,
    MeterBalanceSerializer,
)
from accounts.models import User

logger = logging.getLogger(__name__)

class WalletBalanceView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        try:
            wallet = Wallet.objects.get(user=user)
        except Wallet.DoesNotExist:
            # Auto-create (from previous fix)
            with db_transaction.atomic():
                wallet = Wallet.objects.create(user=user)
                # ... init logic ...
        
        wallet_data = WalletSerializer(wallet).data
        
        # Get MeterBalance (primary)
        meters = MeterBalance.objects.filter(user=user, is_active=True)
        if not meters.exists():
            # Fallback: Query Meter if no MeterBalance
            from meter.models import Meter
            fallback_meters = Meter.objects.filter(user=user)
            if fallback_meters.exists():
                # Create MeterBalance on-the-fly (sync)
                for m in fallback_meters:
                    MeterBalance.objects.get_or_create(
                        user=user,
                        meter_number=m.meter_no,
                        defaults={'balance': Decimal(str(m.units)), 'is_active': True}
                    )
                # Re-query
                meters = MeterBalance.objects.filter(user=user, is_active=True)
        
        meter_data = MeterBalanceSerializer(meters, many=True).data
        
        # Recent transactions (unchanged)
        recent_transactions = Transaction.objects.filter(wallet=wallet).order_by('-created_at')[:10]
        transactions_data = TransactionSerializer(recent_transactions, many=True).data
        
        # Use wallet.balance as total (now synced)
        return Response({
            "success": True,
            "wallet": wallet_data,
            "meters": meter_data,  # Now populated with meter data
            "recent_transactions": transactions_data,
            "total_balance": str(wallet.balance),
        }, status=status.HTTP_200_OK)

class TransactionHistoryView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        try:
            wallet = Wallet.objects.get(user=user)
            
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
            
        except Wallet.DoesNotExist:
            return Response({
                "error": "Wallet not found",
                "success": False
            }, status=status.HTTP_404_NOT_FOUND)
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
            if hasattr(user, 'wallet'):
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