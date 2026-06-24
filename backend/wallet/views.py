from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction, IntegrityError
from decimal import Decimal
import logging
from datetime import datetime

from .models import Wallet, Transaction, MeterBalance
from .serializers import (
    WalletSerializer,
    TransactionSerializer,
    MeterBalanceSerializer,
)
from meter.models import Meter

logger = logging.getLogger(__name__)


def _sync_meter_balances(user):
    """
    Keep MeterBalance rows aligned with Meter records.
    Lookup by Meter (OneToOne) so meter number renames do not orphan rows.
    """
    meter_balances = []
    user_meters = Meter.objects.filter(user=user)

    for meter in user_meters:
        try:
            mb, _created = MeterBalance.objects.update_or_create(
                meter=meter,
                defaults={
                    "user": user,
                    "meter_number": meter.meter_no,
                    "balance": meter.units,
                    "is_active": True,
                },
            )
            meter_balances.append(mb)
        except IntegrityError:
            logger.warning(
                "MeterBalance sync conflict for meter %s (user %s); falling back to meter_number lookup",
                meter.meter_no,
                user.id,
                exc_info=True,
            )
            try:
                mb, _created = MeterBalance.objects.update_or_create(
                    meter_number=meter.meter_no,
                    defaults={
                        "user": user,
                        "meter": meter,
                        "balance": meter.units,
                        "is_active": True,
                    },
                )
                meter_balances.append(mb)
            except Exception:
                logger.exception("MeterBalance sync failed for meter %s", meter.meter_no)
        except Exception:
            logger.exception("MeterBalance sync failed for meter %s", meter.meter_no)

    active_numbers = {m.meter_no for m in user_meters}
    if active_numbers:
        MeterBalance.objects.filter(user=user).exclude(
            meter_number__in=active_numbers
        ).update(is_active=False)

    for mb in MeterBalance.objects.filter(user=user).select_related("meter"):
        if mb.meter and mb.meter_number != mb.meter.meter_no:
            mb.meter_number = mb.meter.meter_no
            try:
                mb.save(update_fields=["meter_number"])
            except IntegrityError:
                logger.warning(
                    "Could not rename MeterBalance %s to %s (duplicate meter_number)",
                    mb.id,
                    mb.meter.meter_no,
                )

    return meter_balances


class WalletBalanceView(APIView):
    """
    Returns the user's unit wallet balance (kWh available to share/load) plus meter snapshots.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        try:
            wallet, created = Wallet.objects.get_or_create(user=user)
            if created:
                logger.info("Auto-created unit wallet for user %s", user.username)

            wallet_data = WalletSerializer(wallet).data
            unit_balance = wallet.balance

            meter_balances = []
            meter_data = []
            try:
                with db_transaction.atomic():
                    meter_balances = _sync_meter_balances(user)
                meter_data = MeterBalanceSerializer(meter_balances, many=True).data
            except Exception:
                logger.exception("Meter balance sync failed for user %s", user.username)
                meter_balances = list(
                    MeterBalance.objects.filter(user=user, is_active=True).select_related("meter")
                )
                meter_data = MeterBalanceSerializer(meter_balances, many=True).data

            recent_transactions = Transaction.objects.filter(wallet=wallet).order_by("-created_at")[:10]
            transactions_data = TransactionSerializer(recent_transactions, many=True).data

            total_meter_units = sum(
                Decimal(str(mb.balance)) for mb in meter_balances
            ) if meter_balances else Decimal("0.00")

            response_data = {
                "success": True,
                "wallet": wallet_data,
                "meters": meter_data,
                "recent_transactions": transactions_data,
                "wallet_balance": str(unit_balance),
                "unit_wallet_balance": str(unit_balance),
                "total_meter_units": str(total_meter_units),
                "meter_count": len(meter_balances),
                "timestamp": datetime.now().isoformat(),
            }

            if meter_balances:
                primary_meter = meter_balances[0]
                response_data["primary_meter"] = {
                    "meter_number": primary_meter.meter_number,
                    "balance": str(primary_meter.balance),
                    "is_active": primary_meter.is_active,
                }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(
                "Error in WalletBalanceView for user %s: %s",
                user.username,
                str(e),
                exc_info=True,
            )
            return Response(
                {
                    "success": False,
                    "error": "Failed to retrieve balance information. Please try again later.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class TransactionHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        try:
            wallet, _ = Wallet.objects.get_or_create(user=user)

            transaction_type = request.GET.get("type")
            start_date = request.GET.get("start_date")
            end_date = request.GET.get("end_date")
            limit = int(request.GET.get("limit", 50))

            transactions = Transaction.objects.filter(wallet=wallet)

            if transaction_type:
                transactions = transactions.filter(transaction_type=transaction_type)

            if start_date:
                transactions = transactions.filter(created_at__gte=start_date)

            if end_date:
                transactions = transactions.filter(created_at__lte=end_date)

            transactions = transactions.order_by("-created_at")[:limit]

            data = TransactionSerializer(transactions, many=True).data

            return Response(
                {
                    "success": True,
                    "count": len(data),
                    "transactions": data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Error fetching transaction history: {str(e)}")
            return Response(
                {
                    "error": "An error occurred while fetching transaction history",
                    "success": False,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CreateWalletView(APIView):
    """Create wallet for existing users who don't have one"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        try:
            if hasattr(user, "mainwallet"):
                return Response(
                    {
                        "error": "Wallet already exists for this user",
                        "success": False,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            wallet = Wallet.objects.create(user=user)

            if hasattr(user, "meter") and user.meter:
                MeterBalance.objects.create(
                    user=user,
                    meter_number=user.meter.meter_number,
                    balance=Decimal("0.00"),
                    is_active=True,
                )

            wallet_data = WalletSerializer(wallet).data

            return Response(
                {
                    "success": True,
                    "message": "Wallet created successfully",
                    "wallet": wallet_data,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.error(f"Error creating wallet: {str(e)}")
            return Response(
                {
                    "error": "An error occurred while creating wallet",
                    "success": False,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
