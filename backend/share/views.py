from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction as db_transaction
from django.utils import timezone
from decimal import Decimal
import uuid
from datetime import datetime, timedelta
import logging
from transactions.models import TransactionType, TransactionLog

from .serializers import ConfirmShareSerializer, TransferUnitsSerializer, VerifyOTPSerializer
from .models import Share, ShareTransaction
from .flow import ShareFlowError, execute_share_units
from accounts.models import User, Wallet as AccountWallet
from wallet.models import Wallet
from meter.models import Meter
from share.services import VerificationCode
from utils.general import format_currency, dispatch_task
from accounts.tasks import (
    handle_send_transfer_verification,
    handle_send_wallet_update,
)

from meter.validators import normalize_meter_no, validate_meter_no

logger = logging.getLogger(__name__)


def _phone_for_api(phone) -> str:
    """Serialize phonenumber_field values for JSON API responses."""
    if not phone:
        return "Not on file"
    return str(phone)


class ShareReceiverPreviewView(APIView):
    """
    GET /api/v1/share/receiver-preview/?meter_number=

    Returns recipient details for the share confirmation step (no side effects).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        meter_number = normalize_meter_no(request.query_params.get("meter_number") or "")
        if not meter_number:
            return Response(
                {"error": "meter_number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ok, msg = validate_meter_no(meter_number)
        if not ok:
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)

        try:
            meter = Meter.objects.select_related("user").get(meter_no=meter_number)
        except Meter.DoesNotExist:
            return Response(
                {"error": "Receiver meter not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if meter.user_id == request.user.id:
            return Response(
                {
                    "error": (
                        "This is your own meter. Use Load Units to top up your AMI meter "
                        "from your wallet."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if meter.status != Meter.STATUS_ACTIVE:
            return Response(
                {"error": "Receiver meter is not active."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        owner = meter.user
        display_name = f"{owner.first_name or ''} {owner.last_name or ''}".strip()
        if not display_name:
            display_name = owner.email or "Unknown"

        is_ami = meter.architecture == Meter.ARCH_AMI
        return Response(
            {
                "success": True,
                "recipient": {
                    "name": display_name,
                    "meter_number": meter.meter_no,
                    "meter_type": meter.architecture,
                    "meter_type_label": "AMI (networked)" if is_ami else "STS (token keypad)",
                    "phone_number": _phone_for_api(owner.phone_number),
                },
                "delivery_method": (
                    "Units will be sent directly to the AMI meter device token (ThingsBoard)."
                    if is_ami
                    else "An STS keypad token will be generated and sent to the recipient."
                ),
            },
            status=status.HTTP_200_OK,
        )


class ShareUnitsView(APIView):
    """
    POST /api/v1/share/share-units/

    Single-step share: meter_number, units, password (account login PIN).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ConfirmShareSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        password = serializer.validated_data["password"]
        if not request.user.check_password(password):
            return Response(
                {"error": "Incorrect PIN. Use the password for your gPAWA account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = execute_share_units(
                sender=request.user,
                receiver_meter_no=serializer.validated_data["meter_number"],
                units=Decimal(str(serializer.validated_data["units"])),
                channel="WEB",
            )
            return Response(result, status=status.HTTP_200_OK)
        except ShareFlowError as exc:
            return Response({"error": exc.message}, status=exc.status_code)
        except Exception as e:
            logger.error("Error completing share: %s", e, exc_info=True)
            return Response(
                {"error": "An error occurred while completing the share"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class TransferUnitsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        verification_code = request.data.get("verification_code")

        if not verification_code:
            serializer = TransferUnitsSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            try:
                with db_transaction.atomic():
                    old_meter_no = serializer.validated_data["meter_no_old"]
                    new_meter_no = serializer.validated_data["meter_no_new"]

                    user = request.user
                    user_wallet, _ = Wallet.objects.select_for_update().get_or_create(user=user)

                    if user_wallet.balance <= 0:
                        return Response({"error": "No units to transfer"}, status=status.HTTP_400_BAD_REQUEST)

                    try:
                        old_meter = Meter.objects.select_for_update().get(
                            meter_no=old_meter_no,
                            user=user,
                            is_active=True,
                        )
                    except Meter.DoesNotExist:
                        return Response(
                            {"error": "Old meter not found or inactive"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    try:
                        new_meter = Meter.objects.select_for_update().get(
                            meter_no=new_meter_no,
                            is_active=True,
                        )
                    except Meter.DoesNotExist:
                        return Response(
                            {"error": "New meter not found or inactive"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if old_meter == new_meter:
                        return Response(
                            {"error": "Old and new meters must be different"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    transaction_ref = f"TRANSFER-{uuid.uuid4().hex[:8].upper()}"

                    request.session["pending_transfer"] = {
                        "old_meter_no": old_meter_no,
                        "new_meter_no": new_meter_no,
                        "units_to_transfer": str(user_wallet.balance),
                        "transaction_ref": transaction_ref,
                        "old_meter_id": old_meter.id,
                        "new_meter_id": new_meter.id,
                    }
                    request.session.modified = True

                    verification = VerificationCode.create_code(
                        user=user,
                        purpose="transfer_units",
                        expiry_minutes=10,
                    )

                    transaction_details = f"""
                    You're transferring all units ({user_wallet.balance}) from meter {old_meter_no} to {new_meter_no}.
                    WARNING: Your old meter will be deactivated!
                    Transaction ID: {transaction_ref}.
                    Code expires: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.
                    """

                    dispatch_task(
                        handle_send_transfer_verification,
                        user.id,
                        verification.code,
                        transaction_details,
                    )

                    return Response(
                        {
                            "success": True,
                            "message": "Verification code sent to your email. Please check and enter the 6-digit code.",
                            "step": "verification",
                            "warning": "This will deactivate your old meter!",
                        },
                        status=status.HTTP_200_OK,
                    )

            except Exception as e:
                logger.error("Error initiating transfer: %s", e, exc_info=True)
                return Response(
                    {"error": "An error occurred while initiating the transfer request"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        otp_serializer = VerifyOTPSerializer(data=request.data)
        if not otp_serializer.is_valid():
            return Response(otp_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        verification_code = otp_serializer.validated_data["verification_code"]
        pending_transfer = request.session.get("pending_transfer")
        if not pending_transfer:
            return Response(
                {"error": "No pending transfer found. Please start over."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        if not VerificationCode.verify_code(user, verification_code, "transfer_units"):
            return Response(
                {"error": "Invalid or expired verification code"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with db_transaction.atomic():
                old_meter_no = pending_transfer["old_meter_no"]
                new_meter_no = pending_transfer["new_meter_no"]
                units_to_transfer = Decimal(pending_transfer["units_to_transfer"])
                transaction_ref = pending_transfer["transaction_ref"]

                user_wallet, _ = Wallet.objects.select_for_update().get_or_create(user=user)
                old_meter = Meter.objects.select_for_update().get(meter_no=old_meter_no)
                new_meter = Meter.objects.select_for_update().get(meter_no=new_meter_no)

                if user_wallet.balance < units_to_transfer:
                    return Response(
                        {"error": "Insufficient units. Transaction cancelled."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                user_wallet.deduct(
                    units_to_transfer,
                    description=f"Transferred to new meter {new_meter_no}",
                    transaction_ref=transaction_ref,
                )

                old_meter.balance = Decimal("0.00")
                old_meter.is_active = False
                old_meter.save()

                new_meter.balance += units_to_transfer
                new_meter.save()

                ShareTransaction.objects.create(
                    share_transaction_id=transaction_ref,
                    sender=user,
                    receiver=new_meter.user if new_meter.user != user else user,
                    units=units_to_transfer,
                    meter_send=old_meter,
                    meter_receive=new_meter,
                    status="COMPLETED",
                    message=f"Meter transfer from {old_meter_no} to {new_meter_no} (old deactivated)",
                )

                update_details = f"""
                Transfer Completed Successfully:
                - Old Meter: {old_meter_no} (Now deactivated)
                - New Meter: {new_meter_no}
                - Units Transferred: {units_to_transfer}
                - New Balance on {new_meter_no}: {new_meter.balance} units
                - Transaction ID: {transaction_ref}
                - Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                """

                dispatch_task(handle_send_wallet_update, user.id, update_details)

                if "pending_transfer" in request.session:
                    del request.session["pending_transfer"]
                request.session.modified = True

                return Response(
                    {
                        "success": True,
                        "message": "Transfer completed successfully",
                        "transaction_id": transaction_ref,
                        "units_transferred": str(units_to_transfer),
                        "new_balance": str(new_meter.balance),
                        "old_meter_deactivated": old_meter_no,
                        "timestamp": timezone.now().isoformat(),
                    },
                    status=status.HTTP_200_OK,
                )

        except Exception as e:
            logger.error("Error completing transfer: %s", e, exc_info=True)
            return Response(
                {"error": "An error occurred while completing the transfer"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
