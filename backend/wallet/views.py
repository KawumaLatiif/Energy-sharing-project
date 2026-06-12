# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from rest_framework.permissions import IsAuthenticated
# from django.db import transaction as db_transaction
# from decimal import Decimal
# import logging
# from datetime import datetime

# from .models import Wallet, Transaction, MeterBalance, UnitBalance
# from .serializers import (
#     WalletSerializer, 
#     TransactionSerializer,
#     MeterBalanceSerializer,
# )
# from accounts.models import User
# from meter.models import Meter
# from transactions.models import TransactionLog, TransactionType

# logger = logging.getLogger(__name__)

# # class WalletBalanceView(APIView):
# #     """
# #     Returns the user's wallet balance + all associated meter balances.
# #     Synchronizes MeterBalance records from Meter.units on every request
# #     to ensure consistency (Meter.units is considered the source of truth
# #     for energy units).
# #     """
# #     permission_classes = [IsAuthenticated]
    
# #     def get(self, request):
# #         user = request.user
        
# #         try:
# #             # Get or auto-create wallet
# #             wallet, created = Wallet.objects.get_or_create(user=user)
# #             if created:
# #                 logger.info(f"Auto-created wallet for user {user.username}")

# #             wallet_data = WalletSerializer(wallet).data
            
# #             # ────────────────────────────────────────────────
# #             # Step 1: Sync all user's Meter → MeterBalance
# #             # ────────────────────────────────────────────────
# #             with db_transaction.atomic():
# #                 user_meters = Meter.objects.filter(user=user)
                
# #                 for meter in user_meters:
# #                     MeterBalance.objects.update_or_create(
# #                         user=user,
# #                         meter_number=meter.meter_no,
# #                         defaults={
# #                             'meter': meter,               # if you added OneToOneField
# #                             'balance': meter.units,       # sync from source of truth
# #                             'is_active': True             # or use meter.is_active if exists
# #                         }
# #                     )
                
# #                 # Optional: Clean up orphaned MeterBalance records
# #                 # (meters that no longer exist for this user)
# #                 existing_meter_nos = {m.meter_no for m in user_meters}
# #                 MeterBalance.objects.filter(user=user).exclude(
# #                     meter_number__in=existing_meter_nos
# #                 ).update(is_active=False)
            
# #             # ────────────────────────────────────────────────
# #             # Step 2: Fetch fresh MeterBalance records
# #             # ────────────────────────────────────────────────
# #             meter_balances = MeterBalance.objects.filter(
# #                 user=user,
# #                 is_active=True
# #             ).select_related('meter')  # if you added the FK
            
# #             meter_data = MeterBalanceSerializer(meter_balances, many=True).data
            
# #             # ────────────────────────────────────────────────
# #             # Step 3: Recent wallet transactions
# #             # ────────────────────────────────────────────────
# #             recent_transactions = Transaction.objects.filter(
# #                 wallet=wallet
# #             ).order_by('-created_at')[:10]
            
# #             transactions_data = TransactionSerializer(recent_transactions, many=True).data
            
# #             # ────────────────────────────────────────────────
# #             # Optional: Calculate total energy units across meters
# #             # (useful for dashboard display)
# #             # ────────────────────────────────────────────────
# #             total_meter_units = sum(
# #                 Decimal(str(mb.balance)) for mb in meter_balances
# #             ) if meter_balances.exists() else Decimal('0.00')
            
# #             # Prepare response
# #             response_data = {
# #                 "success": True,
# #                 "wallet": wallet_data,
# #                 "meters": meter_data,
# #                 "recent_transactions": transactions_data,
# #                 "wallet_balance": str(wallet.balance),           # monetary / purchase balance
# #                 "total_meter_units": str(total_meter_units),     # total energy units across meters
# #                 "meter_count": meter_balances.count(),
# #                 "timestamp": datetime.now().isoformat(),
# #             }
            
# #             if meter_balances.exists():
# #                 # Show primary/active meter if there's one obvious choice
# #                 primary_meter = meter_balances.first()
# #                 response_data["primary_meter"] = {
# #                     "meter_number": primary_meter.meter_number,
# #                     "balance": str(primary_meter.balance),
# #                     "is_active": primary_meter.is_active
# #                 }
            
# #             return Response(response_data, status=status.HTTP_200_OK)
            
# #         except Exception as e:
# #             logger.error(f"Error in WalletBalanceView for user {user.username}: {str(e)}", exc_info=True)
# #             return Response({
# #                 "success": False,
# #                 "error": "Failed to retrieve balance information. Please try again later."
# #             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# class WalletBalanceView(APIView):
#     """
#     Returns user's money wallet balance AND unit balance separately
#     """
#     permission_classes = [IsAuthenticated]
    
#     def get(self, request):
#         user = request.user
        
#         try:
#             # Money wallet (UGX)
#             money_wallet, _ = Wallet.objects.get_or_create(user=user)
            
#             # Unit balance (energy units)
#             unit_balance, _ = UnitBalance.objects.get_or_create(user=user)
            
#             # Get meter balances (existing meters)
#             meter_balances = MeterBalance.objects.filter(
#                 user=user,
#                 is_active=True
#             ).select_related('meter')
            
#             meter_data = MeterBalanceSerializer(meter_balances, many=True).data
            
#             response_data = {
#                 "success": True,
#                 "wallet": {
#                     "balance": str(money_wallet.balance),
#                     "currency": "UGX"
#                 },
#                 "unit_balance": {
#                     "balance": str(unit_balance.balance),
#                     "units": str(unit_balance.balance)
#                 },
#                 "meters": meter_data,
#                 "total_meter_units": sum(float(mb.balance) for mb in meter_balances),
#                 "timestamp": datetime.now().isoformat(),
#             }
            
#             return Response(response_data, status=status.HTTP_200_OK)
            
#         except Exception as e:
#             logger.error(f"Error in WalletBalanceView: {str(e)}", exc_info=True)
#             return Response({
#                 "success": False,
#                 "error": "Failed to retrieve balance information"
#             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



# class TransactionHistoryView(APIView):
#     permission_classes = [IsAuthenticated]
    
#     def get(self, request):
#         user = request.user
        
#         try:
#             wallet, _ = Wallet.objects.get_or_create(user=user)
            
#             # Get query parameters for filtering
#             transaction_type = request.GET.get('type')
#             start_date = request.GET.get('start_date')
#             end_date = request.GET.get('end_date')
#             limit = int(request.GET.get('limit', 50))
            
#             transactions = Transaction.objects.filter(wallet=wallet)
            
#             # Apply filters
#             if transaction_type:
#                 transactions = transactions.filter(transaction_type=transaction_type)
            
#             if start_date:
#                 transactions = transactions.filter(created_at__gte=start_date)
            
#             if end_date:
#                 transactions = transactions.filter(created_at__lte=end_date)
            
#             transactions = transactions.order_by('-created_at')[:limit]
            
#             data = TransactionSerializer(transactions, many=True).data
            
#             return Response({
#                 "success": True,
#                 "count": len(data),
#                 "transactions": data,
#             }, status=status.HTTP_200_OK)
            
#         except Exception as e:
#             logger.error(f"Error fetching transaction history: {str(e)}")
#             return Response({
#                 "error": "An error occurred while fetching transaction history",
#                 "success": False
#             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# class CreateWalletView(APIView):
#     """Create wallet for existing users who don't have one"""
#     permission_classes = [IsAuthenticated]
    
#     def post(self, request):
#         user = request.user
        
#         try:
#             # Check if wallet already exists
#             if hasattr(user, 'mainwallet'):
#                 return Response({
#                     "error": "Wallet already exists for this user",
#                     "success": False
#                 }, status=status.HTTP_400_BAD_REQUEST)
            
#             # Create wallet
#             wallet = Wallet.objects.create(user=user)
            
#             # Initialize meter balance if user has a meter
#             if hasattr(user, 'meter') and user.meter:
#                 MeterBalance.objects.create(
#                     user=user,
#                     meter_number=user.meter.meter_number,
#                     balance=Decimal('0.00'),
#                     is_active=True
#                 )
            
#             wallet_data = WalletSerializer(wallet).data
            
#             return Response({
#                 "success": True,
#                 "message": "Wallet created successfully",
#                 "wallet": wallet_data,
#             }, status=status.HTTP_201_CREATED)
            
#         except Exception as e:
#             logger.error(f"Error creating wallet: {str(e)}")
#             return Response({
#                 "error": "An error occurred while creating wallet",
#                 "success": False
#             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# class WalletDepositView(APIView):
#     """Sandbox wallet deposit. Credits money to the user's wallet."""
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         amount = request.data.get("amount")
#         phone_number = request.data.get("phone_number", "")

#         try:
#             amount = Decimal(str(amount))
#         except Exception:
#             return Response({"success": False, "error": "Amount must be a valid number"}, status=status.HTTP_400_BAD_REQUEST)

#         if amount <= 0:
#             return Response({"success": False, "error": "Amount must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

#         wallet, _ = Wallet.objects.get_or_create(user=request.user)
#         reference = generate_transaction_ref()

#         with db_transaction.atomic():
#             balance = wallet.add(
#                 amount,
#                 description=f"Wallet deposit via sandbox phone payment {phone_number}".strip(),
#                 transaction_ref=reference,
#             )
#             TransactionLog.objects.create(
#                 user=request.user,
#                 transaction_type=TransactionType.WALLET_DEPOSIT,
#                 amount=amount,
#                 units=0,
#                 status="COMPLETED",
#                 reference_id=reference,
#                 details={
#                     "payment_source": "PHONE",
#                     "phone_number": phone_number,
#                     "sandbox": True,
#                 },
#             )

#         return Response({
#             "success": True,
#             "message": "Sandbox deposit completed successfully",
#             "reference": reference,
#             "wallet_balance": str(balance),
#         }, status=status.HTTP_200_OK)


# class WalletWithdrawView(APIView):
#     """Sandbox wallet withdrawal. Debits money from the user's wallet."""
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         amount = request.data.get("amount")
#         phone_number = request.data.get("phone_number", "")

#         try:
#             amount = Decimal(str(amount))
#         except Exception:
#             return Response({"success": False, "error": "Amount must be a valid number"}, status=status.HTTP_400_BAD_REQUEST)

#         if amount <= 0:
#             return Response({"success": False, "error": "Amount must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

#         wallet, _ = Wallet.objects.get_or_create(user=request.user)
#         reference = generate_transaction_ref()

#         try:
#             with db_transaction.atomic():
#                 balance = wallet.deduct(
#                     amount,
#                     description=f"Wallet withdrawal to sandbox phone {phone_number}".strip(),
#                     transaction_ref=reference,
#                 )
#                 TransactionLog.objects.create(
#                     user=request.user,
#                     transaction_type=TransactionType.WALLET_WITHDRAWAL,
#                     amount=amount,
#                     units=0,
#                     status="COMPLETED",
#                     reference_id=reference,
#                     details={
#                         "payment_source": "WALLET",
#                         "phone_number": phone_number,
#                         "sandbox": True,
#                     },
#                 )
#         except ValueError as exc:
#             return Response({"success": False, "error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

#         return Response({
#             "success": True,
#             "message": "Sandbox withdrawal completed successfully",
#             "reference": reference,
#             "wallet_balance": str(balance),
#         }, status=status.HTTP_200_OK)



from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction
from decimal import Decimal
import logging
import uuid
from datetime import datetime

from .models import Wallet, Transaction, MeterBalance, UnitBalance, generate_transaction_ref
from .serializers import (
    WalletSerializer, 
    TransactionSerializer,
    MeterBalanceSerializer,
)
from accounts.models import User
from meter.models import Meter
from transactions.models import TransactionLog, TransactionType

logger = logging.getLogger(__name__)


class WalletBalanceView(APIView):
    """
    Returns user's money wallet balance AND unit balance separately
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        try:
            # Money wallet (UGX)
            money_wallet, _ = Wallet.objects.get_or_create(user=user)
            
            # Unit balance (energy units)
            unit_balance, _ = UnitBalance.objects.get_or_create(user=user)
            
            # Get meter balances (existing meters)
            meter_balances = MeterBalance.objects.filter(
                user=user,
                is_active=True
            ).select_related('meter')
            
            meter_data = MeterBalanceSerializer(meter_balances, many=True).data
            
            response_data = {
                "success": True,
                "wallet": {
                    "balance": str(money_wallet.balance),
                    "currency": "UGX"
                },
                "unit_balance": {
                    "balance": str(unit_balance.balance),
                    "units": str(unit_balance.balance)
                },
                "meters": meter_data,
                "total_meter_units": sum(float(mb.balance) for mb in meter_balances),
                "timestamp": datetime.now().isoformat(),
            }
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in WalletBalanceView: {str(e)}", exc_info=True)
            return Response({
                "success": False,
                "error": "Failed to retrieve balance information"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class WalletDepositView(APIView):
    """
    Deposit money into wallet using MTN MoMo sandbox simulation
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number", "")
        
        # Validate amount
        try:
            amount = Decimal(str(amount))
        except Exception:
            return Response({
                "success": False, 
                "error": "Amount must be a valid number"
            }, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({
                "success": False, 
                "error": "Amount must be greater than 0"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate phone number
        if not phone_number:
            return Response({
                "success": False, 
                "error": "Phone number is required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Format phone number
        phone_number = self.format_phone_number(phone_number)
        
        # For sandbox, simulate deposit immediately
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        reference = generate_transaction_ref()
        
        with db_transaction.atomic():
            balance = wallet.add(
                amount,
                description=f"Deposit via sandbox MoMo {phone_number}",
                transaction_ref=reference,
            )
            TransactionLog.objects.create(
                user=request.user,
                transaction_type=TransactionType.WALLET_DEPOSIT,
                amount=amount,
                units=0,
                status="COMPLETED",
                reference_id=reference,
                details={
                    "payment_source": "MOBILE_MONEY",
                    "phone_number": phone_number,
                    "sandbox": True,
                },
            )
        
        return Response({
            "success": True,
            "message": f"Successfully deposited UGX {amount:,.2f} to your wallet",
            "reference": reference,
            "wallet_balance": str(balance),
            "amount": str(amount),
            "phone_number": phone_number,
        }, status=status.HTTP_200_OK)
    
    def format_phone_number(self, phone):
        """Format phone number to standard format"""
        # Remove any non-digit characters
        phone = ''.join(filter(str.isdigit, phone))
        
        # Check if it's a Ugandan number
        if phone.startswith('0'):
            phone = '256' + phone[1:]
        elif not phone.startswith('256'):
            phone = '256' + phone
        
        return phone


class WalletWithdrawView(APIView):
    """
    Withdraw money from wallet using MTN MoMo sandbox simulation
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get("amount")
        phone_number = request.data.get("phone_number", "")
        
        # Validate amount
        try:
            amount = Decimal(str(amount))
        except Exception:
            return Response({
                "success": False, 
                "error": "Amount must be a valid number"
            }, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({
                "success": False, 
                "error": "Amount must be greater than 0"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate phone number
        if not phone_number:
            return Response({
                "success": False, 
                "error": "Phone number is required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Format phone number
        phone_number = self.format_phone_number(phone_number)
        
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        reference = generate_transaction_ref()
        
        try:
            with db_transaction.atomic():
                balance = wallet.deduct(
                    amount,
                    description=f"Withdrawal to sandbox MoMo {phone_number}",
                    transaction_ref=reference,
                )
                TransactionLog.objects.create(
                    user=request.user,
                    transaction_type=TransactionType.WALLET_WITHDRAWAL,
                    amount=amount,
                    units=0,
                    status="COMPLETED",
                    reference_id=reference,
                    details={
                        "payment_source": "MOBILE_MONEY",
                        "phone_number": phone_number,
                        "sandbox": True,
                    },
                )
        except ValueError as exc:
            return Response({
                "success": False, 
                "error": str(exc)
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "success": True,
            "message": f"Successfully withdrew UGX {amount:,.2f} from your wallet",
            "reference": reference,
            "wallet_balance": str(balance),
            "amount": str(amount),
            "phone_number": phone_number,
        }, status=status.HTTP_200_OK)
    
    def format_phone_number(self, phone):
        """Format phone number to standard format"""
        # Remove any non-digit characters
        phone = ''.join(filter(str.isdigit, phone))
        
        # Check if it's a Ugandan number
        if phone.startswith('0'):
            phone = '256' + phone[1:]
        elif not phone.startswith('256'):
            phone = '256' + phone
        
        return phone


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

