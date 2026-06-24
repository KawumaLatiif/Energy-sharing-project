import logging
import threading
import uuid
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import Wallet as AccountWallet
from loan.models import LoanApplication
from loan.services import (
    LoanOperationError,
    create_loan_application,
    disburse_loan,
    format_loan_stats_ussd,
    format_wallet_loan_summary,
    get_disbursed_loan_balances,
    get_user_loan_stats,
    repay_loan,
    user_can_purchase_units,
)
from meter.api.views import BuyUnitsView
from meter.models import Meter, MeterToken
from meter.services import push_units_to_thingsboard, query_latest_units_from_thingsboard, record_balance_snapshot
from utils.ami_gateway import apply_units_to_meter
from share.models import ShareTransaction
from share.services import VerificationCode
from transactions.models import Transaction, TransactionLog, TransactionType, UnitTransaction
from transactions.api.generate_token import generate_numeric_token
from ussd.models import UssdSession
from wallet.models import Wallet as UnitWallet

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def ussd_phone_numbers(request):
    """
    Lightweight helper endpoint for local simulator.
    Returns users that have phone numbers so the UI can provide quick selection.
    """
    from accounts.models import User

    users = (
        User.objects.exclude(phone_number__isnull=True)
        .exclude(phone_number="")
        .only("id", "email", "phone_number")
        .order_by("email")[:100]
    )
    items = [{"phone_number": str(user.phone_number), "email": user.email} for user in users]
    return Response({"results": items})


@api_view(["GET"])
@permission_classes([AllowAny])
def ussd_receiver_meters(request):
    """
    Helper endpoint for the local simulator.
    Returns available receiver meter numbers excluding sender's own meter.
    """
    phone_number = str(request.query_params.get("phoneNumber", "")).strip()
    sender_user = _find_user_by_phone(phone_number) if phone_number else None
    sender_meter_no = None

    if sender_user:
        sender_meter = Meter.objects.filter(user=sender_user).only("meter_no").first()
        sender_meter_no = sender_meter.meter_no if sender_meter else None

    meters_qs = Meter.objects.select_related("user").only("meter_no", "user__email").order_by("meter_no")
    if sender_meter_no:
        meters_qs = meters_qs.exclude(meter_no=sender_meter_no)

    items = [{"meter_no": meter.meter_no, "email": meter.user.email} for meter in meters_qs[:200]]
    return Response({"results": items})


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in str(phone or "") if ch.isdigit())


def _find_user_by_phone(phone_number: str):
    from accounts.models import User

    incoming = _normalize_phone(phone_number)
    if not incoming:
        return None

    candidates = []
    for user in User.objects.exclude(phone_number__isnull=True).exclude(phone_number="").only(
        "id", "phone_number"
    ):
        stored = _normalize_phone(user.phone_number)
        if not stored:
            continue
        if stored == incoming:
            return user
        if stored.endswith(incoming[-9:]) or incoming.endswith(stored[-9:]):
            candidates.append(user)

    return candidates[0] if len(candidates) == 1 else None


def _menu(text: str) -> list[str]:
    if not text:
        return []
    return [segment.strip() for segment in text.split("*") if segment.strip() != ""]


def _resp(prefix: str, message: str):
    return Response(f"{prefix} {message}", content_type="text/plain")


def _session_reply(session: UssdSession, prefix: str, message: str, menu: str = "", context: dict | None = None):
    merged_context = dict(session.context or {})
    if context:
        merged_context.update(context)
    merged_context["last_response"] = f"{prefix} {message}"
    session.current_menu = menu or session.current_menu
    session.context = merged_context
    session.touch()
    return _resp(prefix, message)



def _start_buy_units(user, phone_number: str, amount_raw: str):
    meter = Meter.objects.filter(user=user).first()
    if not meter:
        return False, "No meter found. Register your meter in app first."

    can_buy, purchase_message = user_can_purchase_units(user)
    if not can_buy:
        return False, purchase_message

    try:
        amount = Decimal(str(amount_raw))
    except (InvalidOperation, TypeError, ValueError):
        return False, "Invalid amount."

    if amount <= 0:
        return False, "Amount must be greater than zero."

    account_wallet = AccountWallet.objects.filter(user=user).order_by("-create_date").first()
    if account_wallet is None:
        account_wallet = AccountWallet.objects.create(user=user)

    buy_view = BuyUnitsView()
    _, total_outstanding = get_disbursed_loan_balances(user)
    estimated_buy_amount = max(Decimal("0"), amount - total_outstanding)
    estimated_units, tariff = buy_view._calculate_units_from_tariff(estimated_buy_amount, user)

    try:
        tx = Transaction.objects.create(
            wallet=account_wallet,
            amount=amount,
            phone_number=phone_number,
            status="PENDING",
            transaction_reference=str(uuid.uuid4()),
            message=f"USSD Buy units - {amount} UGX",
        )
    except Exception:
        return False, "Invalid phone number format."

    if settings.MTN_MOMO_CONFIG.get("ENVIRONMENT", "sandbox") == "sandbox":
        threading.Thread(
            target=buy_view._simulate_sandbox_payment,
            args=(user.id, str(amount), tx.id, meter.id),
            daemon=True,
        ).start()
        return True, (
            f"Payment initiated.\nTxID: {tx.id}\nStatus: PENDING\n"
            f"Estimated units: {estimated_units}\nTariff: {tariff.tariff_code if tariff else 'DEFAULT_500'}"
        )

    # Production fallback if real MoMo path is not yet wired in BuyUnitsView
    return True, f"Payment request created.\nTxID: {tx.id}\nUse option 2 to check status."


def _check_buy_status(user, tx_id_raw: str):
    try:
        tx_id = int(tx_id_raw)
    except (TypeError, ValueError):
        return False, "Invalid transaction ID."

    try:
        transaction = Transaction.objects.get(id=tx_id, wallet__user=user)
    except Transaction.DoesNotExist:
        return False, "Transaction not found."

    if transaction.status == "COMPLETED":
        unit_tx = UnitTransaction.objects.filter(
            sender=user,
            receiver=user,
            direction="IN",
            status="COMPLETED",
            create_date__gte=transaction.create_date,
        ).order_by("-create_date").first()
        units = float(unit_tx.units) if unit_tx else 0.0
        return True, f"SUCCESS\nAmount: UGX {transaction.amount}\nUnits: {units}\nTxID: {transaction.id}"
    if transaction.status == "FAILED":
        return True, f"FAILED\nTxID: {transaction.id}"
    return True, f"PENDING\nTxID: {transaction.id}"


def _apply_loan(user, amount_raw: str):
    try:
        loan = create_loan_application(
            user,
            amount_requested=amount_raw,
            purpose="USSD application",
            tenure_months=6,
            channel="USSD",
        )
    except LoanOperationError as exc:
        return False, exc.message

    if loan.status == "APPROVED":
        return True, (
            f"Loan approved.\nID: {loan.id}\nLoanRef: {loan.loan_id}\n"
            f"Approved UGX {loan.amount_approved}"
        )
    return True, f"Loan rejected.\nReason: {loan.rejection_reason}"


def _disburse_loan(user, loan_id_raw: str):
    try:
        result = disburse_loan(user, loan_id_raw, channel="USSD")
    except LoanOperationError as exc:
        return False, exc.message

    return True, (
        f"Loan disbursed.\nLoanRef: {result['loan_id']}\n"
        f"Units added: {result['units_disbursed']}\n"
        f"Meter push: {'OK' if result['meter_push_ok'] else 'FAILED'}"
    )


def _repay_loan(user, loan_id_raw: str, amount_raw: str):
    try:
        result = repay_loan(
            user,
            loan_id_raw,
            amount_raw,
            channel="USSD",
            payment_method="MOBILE_MONEY",
        )
    except LoanOperationError as exc:
        return False, exc.message

    return True, (
        f"{result['message']}\nLoanRef: {result['loan_id']}\n"
        f"Outstanding: UGX {result['outstanding_balance']}\n"
        f"Units added: {result['units_added']}"
    )


def _share_initiate(user, receiver_meter_no: str, units_raw: str):
    sender_meter = Meter.objects.filter(user=user).first()
    if not sender_meter:
        return False, "No sender meter found."

    try:
        units = Decimal(str(units_raw))
    except (InvalidOperation, ValueError):
        return False, "Invalid units."

    if units < Decimal("2"):
        return False, "Minimum 2 units required."

    sender_wallet, _ = UnitWallet.objects.get_or_create(user=user)
    if sender_wallet.balance < units:
        return False, f"Insufficient units. Wallet balance is {sender_wallet.balance}."

    try:
        receiver_meter = Meter.objects.get(meter_no=receiver_meter_no)
    except Meter.DoesNotExist:
        return False, "Receiver meter not found."

    if receiver_meter.user_id == user.id:
        return False, (
            "Cannot share to your own meter. "
            "Use Manage->4 Apply wallet (AMI) or Tokens->2 (STS) to load units."
        )

    ShareTransaction.objects.filter(sender=user, status="PENDING").update(
        status="CANCELLED", message="Cancelled due to newer USSD request"
    )

    tx_ref = f"SHARE-{uuid.uuid4().hex[:8].upper()}"
    ShareTransaction.objects.create(
        share_transaction_id=tx_ref,
        sender=user,
        receiver=receiver_meter.user,
        units=units,
        meter_send=sender_meter,
        meter_receive=receiver_meter,
        direction="OUT",
        status="PENDING",
        message=f"USSD pending OTP share to {receiver_meter_no}",
    )

    verification = VerificationCode.create_code(user=user, purpose="share_units", expiry_minutes=10)
    if verification and user.email:
        from utils.general import dispatch_task
        from accounts.tasks import handle_send_share_verification
        transaction_details = (
            f"Sharing {units} units to meter {receiver_meter_no}. "
            f"Ref: {tx_ref}. Code expires in 10 minutes."
        )
        dispatch_task(
            handle_send_share_verification,
            user.id,
            verification.code,
            transaction_details,
        )
    return True, (
        f"Share initiated.\nRef: {tx_ref}\n"
        + ("OTP sent to your email.\n" if user.email else "")
        + "Enter OTP via Share->Verify."
    )


def _share_verify(user, tx_ref: str, otp_code: str):
    pending = ShareTransaction.objects.filter(
        sender=user, status="PENDING", share_transaction_id=tx_ref
    ).order_by("-create_date").first()
    if not pending:
        return False, "Pending share not found."

    if not VerificationCode.verify_code(user, otp_code, "share_units"):
        return False, "Invalid or expired OTP."

    with db_transaction.atomic():
        sender_wallet, _ = UnitWallet.objects.select_for_update().get_or_create(user=user)
        if sender_wallet.balance < pending.units:
            return False, "Insufficient units."

        sender_wallet.balance -= pending.units
        sender_wallet.save()

        receiver_meter = pending.meter_receive
        msg_suffix = ""
        share_token = None

        if receiver_meter.architecture == Meter.ARCH_STS:
            share_token = generate_numeric_token()
            MeterToken.objects.create(
                token=share_token,
                units=pending.units,
                meter=receiver_meter,
                user=receiver_meter.user,
                is_used=False,
                source="SHARE",
                share_transaction_id=pending.share_transaction_id,
                share_sender=user,
            )
            msg_suffix = f"STS token sent to receiver ({receiver_meter.meter_no})."
            if receiver_meter.user.email:
                from utils.general import dispatch_task
                from accounts.tasks import handle_send_share_token

                dispatch_task(
                    handle_send_share_token,
                    receiver_meter.user.id,
                    share_token,
                    str(pending.units),
                    receiver_meter.meter_no,
                    sender_meter=pending.meter_send.meter_no,
                    sender_email=user.email,
                )
        elif receiver_meter.architecture == Meter.ARCH_AMI:
            if not apply_units_to_meter(receiver_meter, pending.units):
                return False, "Failed to deliver units to AMI meter via ThingsBoard."
            receiver_meter.refresh_from_db(fields=["units"])
            msg_suffix = (
                f"AMI meter {receiver_meter.meter_no} topped up. "
                f"Balance: {float(receiver_meter.units):.2f} kWh."
            )
            if receiver_meter.user.email:
                from utils.general import dispatch_task
                from accounts.tasks import handle_send_wallet_update

                receiver_update = (
                    f"{pending.units} units applied to your AMI meter {receiver_meter.meter_no}.\n"
                    f"Transaction ID: {pending.share_transaction_id}\n"
                    f"Current meter balance: {receiver_meter.units} kWh"
                )
                dispatch_task(handle_send_wallet_update, receiver_meter.user.id, receiver_update)
        else:
            return False, "Unknown receiver meter type."

        pending.status = "COMPLETED"
        pending.verified_at = timezone.now()
        pending.message = "Completed via USSD"
        pending.save(update_fields=["status", "verified_at", "message", "modify_date"])

        TransactionLog.objects.create(
            user=user,
            transaction_type=TransactionType.UNIT_SHARE,
            units=pending.units,
            status="COMPLETED",
            reference_id=pending.share_transaction_id,
            details={"channel": "USSD", "receiver_meter": pending.meter_receive.meter_no},
        )

    return True, f"Share completed.\nRef: {pending.share_transaction_id}\nUnits: {pending.units}\n{msg_suffix}" + (
        f"\nToken: {share_token}" if share_token else ""
    )


def _generate_sts_token(user, units_raw: str):
    meter = Meter.objects.filter(user=user, architecture=Meter.ARCH_STS).first()
    if not meter:
        return False, "No STS meter found."

    try:
        amount = Decimal(str(units_raw))
    except (InvalidOperation, ValueError):
        return False, "Invalid units."

    if amount <= 0:
        return False, "Units must be greater than zero."

    unit_wallet, _ = UnitWallet.objects.get_or_create(user=user)
    if unit_wallet.balance < amount:
        return False, f"Insufficient wallet. Balance: {float(unit_wallet.balance):.2f} kWh."

    try:
        with db_transaction.atomic():
            locked = UnitWallet.objects.select_for_update().get(user=user)
            if locked.balance < amount:
                return False, "Insufficient wallet balance."
            locked.balance -= amount
            locked.save(update_fields=["balance"])
            token_value = generate_numeric_token()
            MeterToken.objects.create(
                user=user,
                token=token_value,
                units=amount,
                meter=meter,
                source="PURCHASE",
            )
        return True, f"Token: {token_value}\nUnits: {float(amount):.2f} kWh\nWallet: {float(locked.balance):.2f} kWh"
    except Exception:
        return False, "Failed to generate token."


def _apply_wallet_to_ami(user, units_raw: str, meter_no: str | None = None):
    qs = Meter.objects.filter(user=user, architecture=Meter.ARCH_AMI)
    if meter_no:
        qs = qs.filter(meter_no=meter_no)
    meter = qs.first()
    if not meter:
        return False, "No AMI meter found."

    try:
        amount = Decimal(str(units_raw))
    except (InvalidOperation, ValueError):
        return False, "Invalid units."

    if amount <= 0:
        return False, "Units must be greater than zero."

    unit_wallet, _ = UnitWallet.objects.get_or_create(user=user)
    if unit_wallet.balance < amount:
        return False, f"Insufficient wallet. Balance: {float(unit_wallet.balance):.2f} kWh."

    try:
        with db_transaction.atomic():
            locked = UnitWallet.objects.select_for_update().get(user=user)
            if locked.balance < amount:
                return False, "Insufficient wallet balance."
            locked.balance -= amount
            locked.save(update_fields=["balance"])
            if not apply_units_to_meter(meter, amount):
                raise ValueError("AMI apply failed")
            meter.refresh_from_db(fields=["units"])
        return True, (
            f"Applied {float(amount):.2f} kWh to {meter.meter_no}.\n"
            f"Meter: {float(meter.units):.2f} kWh\n"
            f"Wallet: {float(locked.balance):.2f} kWh"
        )
    except ValueError as exc:
        return False, str(exc)
    except Exception:
        return False, "Failed to apply units to AMI meter."


def _user_meters_summary(user):
    meters = list(Meter.objects.filter(user=user).order_by("create_date"))
    if not meters:
        return False, "No meters registered."
    lines = ["Your meters:"]
    for m in meters:
        token_hint = "TB" if (m.iot_device_token or "").strip() else "no-token"
        label = f" ({m.label})" if m.label and m.label != "Home" else ""
        lines.append(
            f"{m.meter_no}{label} | {m.architecture} | {float(m.units):.2f} kWh ({token_hint})"
        )
    return True, "\n".join(lines)


def _ami_meters_for_user(user):
    return list(
        Meter.objects.filter(user=user, architecture=Meter.ARCH_AMI).order_by("create_date")
    )


def _ami_meter_picker_message(meters):
    lines = ["Check units - pick meter:"]
    for i, m in enumerate(meters, 1):
        lines.append(f"{i}. {m.meter_no}")
    return "\n".join(lines)


def _check_units_for_meter(user, meter_no: str):
    try:
        meter = Meter.objects.get(user=user, meter_no=meter_no, architecture=Meter.ARCH_AMI)
    except Meter.DoesNotExist:
        return False, "AMI meter not found on your account."

    ok, msg, data = query_latest_units_from_thingsboard(meter)
    if not ok or not data:
        return False, msg or "Could not read units from ThingsBoard."

    record_balance_snapshot(
        meter,
        data["units_kwh"],
        source=data.get("source", "thingsboard"),
    )

    return True, (
        f"Meter {meter.meter_no}\n"
        f"Live (TB): {data['units_kwh']:.2f} kWh\n"
        f"Ledger: {float(meter.units):.2f} kWh"
    )


def _reply_ussd_check_units(user, ussd_session, text, steps):
    """AMI check-units flow for paths like 1*2 or 1*2*<meter pick>."""
    ami_meters = _ami_meters_for_user(user)
    if not ami_meters:
        ussd_session.last_text = text
        ussd_session.save(update_fields=["user", "last_text", "updated_at"])
        return _session_reply(
            ussd_session,
            "END",
            "No AMI meter on your account.",
            menu="check_units",
        )

    if len(ami_meters) == 1:
        ok, msg = _check_units_for_meter(user, ami_meters[0].meter_no)
        ussd_session.last_text = text
        ussd_session.save(update_fields=["user", "last_text", "updated_at"])
        return _session_reply(
            ussd_session,
            "END",
            msg if ok else f"Error: {msg}",
            menu="check_units",
        )

    if len(steps) == 2:
        ussd_session.last_text = text
        ussd_session.save(update_fields=["user", "last_text", "updated_at"])
        return _session_reply(
            ussd_session,
            "CON",
            _ami_meter_picker_message(ami_meters),
            menu="check_units_pick",
            context={"ami_meter_nos": [m.meter_no for m in ami_meters]},
        )

    try:
        pick = int(steps[2])
        meter_nos = (ussd_session.context or {}).get("ami_meter_nos") or [
            m.meter_no for m in ami_meters
        ]
        if pick < 1 or pick > len(meter_nos):
            raise ValueError("out of range")
        meter_no = meter_nos[pick - 1]
    except (ValueError, TypeError, IndexError):
        ussd_session.last_text = text
        ussd_session.save(update_fields=["user", "last_text", "updated_at"])
        return _session_reply(ussd_session, "END", "Invalid meter selection.", menu="check_units")

    ok, msg = _check_units_for_meter(user, meter_no)
    ussd_session.last_text = text
    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
    return _session_reply(
        ussd_session,
        "END",
        msg if ok else f"Error: {msg}",
        menu="check_units",
    )


def _notifications_summary(user):
    from meter.models import MeterNotification

    unread = MeterNotification.objects.filter(user=user, is_read=False).count()
    recent = list(
        MeterNotification.objects.filter(user=user)
        .select_related("meter")
        .order_by("-occurred_at")[:5]
    )
    if not recent:
        return True, f"No alerts.\nUnread: {unread}"

    lines = [f"Alerts (unread: {unread}):"]
    for n in recent:
        mark = "*" if not n.is_read else ""
        mno = n.meter.meter_no if n.meter else "?"
        lines.append(f"{mark}{mno}: {float(n.units_kwh):.2f} kWh")
    lines.append("Top up via Buy Units (menu 2).")
    return True, "\n".join(lines)


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def ussd_entry(request):
    """
    USSD endpoint in Africa's Talking format:
    - sessionId
    - serviceCode
    - phoneNumber
    - text
    """
    session_id = str(request.data.get("sessionId", "")).strip() or f"fallback-{uuid.uuid4().hex[:10]}"
    service_code = str(request.data.get("serviceCode", "")).strip()
    phone_number = request.data.get("phoneNumber", "")
    text = request.data.get("text", "")

    ussd_session, _ = UssdSession.objects.get_or_create(
        session_id=session_id,
        defaults={
            "service_code": service_code,
            "phone_number": str(phone_number),
            "expires_at": UssdSession.default_expiry(),
        },
    )
    if ussd_session.expired:
        ussd_session.reset()
    ussd_session.service_code = service_code or ussd_session.service_code
    ussd_session.phone_number = str(phone_number)

    user = _find_user_by_phone(phone_number)
    if not user:
        ussd_session.user = None
        ussd_session.last_text = text or ""
        ussd_session.is_active = False
        ussd_session.save(update_fields=["user", "last_text", "is_active", "updated_at"])
        return _session_reply(
            ussd_session,
            "END",
            "Account not found. Please register first on the web app.",
        )
    ussd_session.user = user

    # Basic dedupe for provider retries to prevent duplicate side effects.
    if text and text == ussd_session.last_text:
        cached = (ussd_session.context or {}).get("last_response")
        if cached:
            return Response(cached, content_type="text/plain")

    meter = Meter.objects.filter(user=user).first()
    wallet, _ = UnitWallet.objects.get_or_create(user=user)
    steps = _menu(text)

    try:
        if len(steps) == 0:
            ussd_session.last_text = text or ""
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(
                ussd_session,
                "CON",
                (
                    "gPawa\n"
                    "1. Wallet & Meter\n"
                    "2. Buy Units\n"
                    "3. Loans\n"
                    "4. Share Units\n"
                    "5. My Tokens\n"
                    "6. Manage\n"
                    "7. Alerts\n"
                    "8. Exit\n"
                    "9. Energy Usage"
                ),
                menu="root",
            )

        # 1) Wallet and meter
        if steps[0] == "1":
            if len(steps) == 1:
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "CON",
                    (
                        "Wallet & Meter\n"
                        "1. Summary\n"
                        "2. Check units (AMI)"
                    ),
                    menu="wallet_menu",
                )

            if steps[1] == "1":
                loan_stats = get_user_loan_stats(user)
                meter_no = meter.meter_no if meter else "Not registered"
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "END",
                    (
                        f"Wallet: {wallet.balance} units\n"
                        f"Meter: {meter_no}\n"
                        f"{format_wallet_loan_summary(loan_stats)}"
                    ),
                    menu="wallet_overview",
                )

            if steps[1] == "2":
                return _reply_ussd_check_units(user, ussd_session, text, steps)

            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(ussd_session, "END", "Invalid wallet option.")

        # 2) Buy units full flow
        if steps[0] == "2":
            if len(steps) == 1:
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "CON", "Buy Units\n1. Start purchase\n2. Check payment status", menu="buy_menu")

            if steps[1] == "1":
                if len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "CON", "Enter amount in UGX:", menu="buy_amount")
                ok, msg = _start_buy_units(user, phone_number, steps[2])
                ctx = {}
                if ok:
                    tx_line = [line for line in msg.split("\n") if line.startswith("TxID:")]
                    if tx_line:
                        try:
                            ctx["last_buy_transaction_id"] = int(tx_line[0].split(":")[1].strip())
                        except Exception:
                            pass
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="buy_result", context=ctx)

            if steps[1] == "2":
                if len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    hint = ""
                    last_tx = (ussd_session.context or {}).get("last_buy_transaction_id")
                    if last_tx:
                        hint = f"\nTip: use {last_tx}"
                    return _session_reply(ussd_session, "CON", f"Enter transaction ID:{hint}", menu="buy_status")
                tx_input = steps[2]
                if tx_input == "0":
                    tx_input = str((ussd_session.context or {}).get("last_buy_transaction_id", ""))
                ok, msg = _check_buy_status(user, tx_input)
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="buy_status_result")

            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(ussd_session, "END", "Invalid buy-units option.")

        # 3) Loans
        if steps[0] == "3":
            if len(steps) == 1:
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "CON",
                    (
                        "Loans\n"
                        "1. Latest loan\n"
                        "2. Apply loan\n"
                        "3. Disburse loan\n"
                        "4. Repay loan\n"
                        "5. Loan stats"
                    ),
                    menu="loans_menu",
                )

            if steps[1] == "1":
                loan = LoanApplication.objects.filter(user=user).order_by("-created_at").first()
                if not loan:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "END", "No loan record found.", menu="loan_latest")
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "END",
                    (
                        f"LoanID: {loan.id}\nRef: {loan.loan_id}\nStatus: {loan.status}\n"
                        f"Requested: UGX {loan.amount_requested}\nApproved: UGX {loan.amount_approved or 0}\n"
                        f"Outstanding: UGX {loan.outstanding_balance}"
                    ),
                    menu="loan_latest",
                )

            if steps[1] == "2":
                if len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "CON", "Enter amount in UGX (5000-200000):", menu="loan_apply_amount")
                ok, msg = _apply_loan(user, steps[2])
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="loan_apply_result")

            if steps[1] == "3":
                if len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "CON", "Enter LoanID to disburse (or 0 for latest approved):", menu="loan_disburse_pick")
                ok, msg = _disburse_loan(user, steps[2])
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="loan_disburse_result")

            if steps[1] == "4":
                if len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "CON", "Enter LoanID:", menu="loan_repay_loan")
                if len(steps) == 3:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "CON", "Enter repayment amount UGX:", menu="loan_repay_amount")
                ok, msg = _repay_loan(user, steps[2], steps[3])
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="loan_repay_result")

            if steps[1] == "5":
                loan_stats = get_user_loan_stats(user)
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "END",
                    format_loan_stats_ussd(loan_stats),
                    menu="loan_stats",
                )

            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(ussd_session, "END", "Invalid loan option.")

        # 4) Share units (OTP)
        if steps[0] == "4":
            if len(steps) == 1:
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "CON", "Share Units\n1. Initiate share\n2. Verify OTP", menu="share_menu")

            if steps[1] == "1":
                if len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "CON", "Enter receiver meter number:", menu="share_meter")
                if len(steps) == 3:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "CON", "Enter units to share (min 2):", menu="share_units")
                ok, msg = _share_initiate(user, steps[2], steps[3])
                ctx = {}
                if ok and "Ref:" in msg:
                    try:
                        ctx["last_share_ref"] = msg.split("Ref:")[1].split("\n")[0].strip()
                    except Exception:
                        pass
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="share_initiate_result", context=ctx)

            if steps[1] == "2":
                if len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    tip = (ussd_session.context or {}).get("last_share_ref")
                    hint = f"\nTip: {tip}" if tip else ""
                    return _session_reply(ussd_session, "CON", f"Enter transaction ref:{hint}", menu="share_verify_ref")
                if len(steps) == 3:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "CON", "Enter 6-digit OTP:", menu="share_verify_otp")
                share_ref = steps[2]
                if share_ref == "0":
                    share_ref = str((ussd_session.context or {}).get("last_share_ref", ""))
                ok, msg = _share_verify(user, share_ref, steps[3])
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="share_verify_result")

            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(ussd_session, "END", "Invalid share option.")

        # 5) Tokens — list or generate STS
        if steps[0] == "5":
            if len(steps) == 1:
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "CON",
                    "My Tokens\n1. List unused\n2. Generate STS token",
                    menu="tokens_menu",
                )

            if steps[1] == "1":
                tokens = MeterToken.objects.filter(user=user, is_used=False).order_by("-create_date")[:3]
                if not tokens:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "END", "No active tokens found.", menu="tokens")
                lines = ["Active tokens:"]
                for t in tokens:
                    lines.append(f"{t.token} | {t.units}u | {t.source}")
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", "\n".join(lines), menu="tokens")

            if steps[1] == "2":
                if len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(
                        ussd_session,
                        "CON",
                        f"Enter kWh from wallet (max {float(wallet.balance):.2f}):",
                        menu="token_generate_amount",
                    )
                ok, msg = _generate_sts_token(user, steps[2])
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="token_generate")

            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(ussd_session, "END", "Invalid token option.")

        # 6) Manage — meters, check units (AMI), alerts, apply wallet
        if steps[0] == "6":
            if len(steps) == 1:
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "CON",
                    (
                        "Manage\n"
                        "1. My meters\n"
                        "2. Alerts\n"
                        "3. Apply wallet (AMI)"
                    ),
                    menu="manage_menu",
                )

            if steps[1] == "1":
                ok, msg = _user_meters_summary(user)
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "END",
                    msg if ok else f"Error: {msg}",
                    menu="manage_meters",
                )

            if steps[1] == "2":
                ok, msg = _notifications_summary(user)
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg, menu="manage_alerts")

            if steps[1] == "3":
                ami_meters = _ami_meters_for_user(user)
                if not ami_meters:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(ussd_session, "END", "No AMI meter on your account.", menu="apply_ami")

                if len(ami_meters) == 1 and len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(
                        ussd_session,
                        "CON",
                        f"Apply kWh to {ami_meters[0].meter_no}\nEnter amount:",
                        menu="apply_ami_amount",
                        context={"apply_ami_meter": ami_meters[0].meter_no},
                    )

                if len(ami_meters) > 1 and len(steps) == 2:
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(
                        ussd_session,
                        "CON",
                        _ami_meter_picker_message(ami_meters).replace("Check units", "Apply to"),
                        menu="apply_ami_pick",
                        context={"ami_meter_nos": [m.meter_no for m in ami_meters]},
                    )

                meter_no = (ussd_session.context or {}).get("apply_ami_meter")
                if len(ami_meters) > 1 and len(steps) == 3 and not meter_no:
                    try:
                        pick = int(steps[2])
                        meter_nos = (ussd_session.context or {}).get("ami_meter_nos") or [
                            m.meter_no for m in ami_meters
                        ]
                        meter_no = meter_nos[pick - 1]
                    except (ValueError, TypeError, IndexError):
                        ussd_session.last_text = text
                        ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                        return _session_reply(ussd_session, "END", "Invalid meter selection.", menu="apply_ami")
                    ussd_session.last_text = text
                    ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                    return _session_reply(
                        ussd_session,
                        "CON",
                        f"Enter kWh to apply to {meter_no}:",
                        menu="apply_ami_amount",
                        context={"apply_ami_meter": meter_no},
                    )

                amount_raw = steps[-1]
                meter_no = meter_no or (ami_meters[0].meter_no if len(ami_meters) == 1 else None)
                ok, msg = _apply_wallet_to_ami(user, amount_raw, meter_no)
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", msg if ok else f"Error: {msg}", menu="apply_ami")

            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(ussd_session, "END", "Invalid manage option.")

        # 7) Alerts shortcut
        if steps[0] == "7":
            ok, msg = _notifications_summary(user)
            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(ussd_session, "END", msg, menu="alerts")

        # 8) Exit
        if steps[0] == "8":
            ussd_session.last_text = text
            ussd_session.is_active = False
            ussd_session.save(update_fields=["user", "last_text", "is_active", "updated_at"])
            return _session_reply(ussd_session, "END", "Thank you for using gPawa.", menu="exit")

        # 9) Energy Usage — weekly text summary (AMI only)
        if steps[0] == "9":
            from meter.usage_service import format_weekly_usage_ussd, get_power_usage_report, get_user_ami_meters

            ami_meters = get_user_ami_meters(user)
            if not ami_meters:
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "END",
                    "This is only for AMI meter users.",
                    menu="power_usage",
                )

            if len(ami_meters) == 1:
                report = get_power_usage_report(user, meter_no=ami_meters[0].meter_no, period="week")
                ok, msg = format_weekly_usage_ussd(report)
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "END",
                    msg if ok else f"Error: {msg}",
                    menu="power_usage",
                )

            if len(steps) == 1:
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "CON",
                    _ami_meter_picker_message(ami_meters).replace("Check units", "Energy Usage"),
                    menu="power_usage_pick",
                    context={"power_usage_meter_nos": [m.meter_no for m in ami_meters]},
                )

            try:
                pick = int(steps[1])
                meter_nos = (ussd_session.context or {}).get("power_usage_meter_nos") or [
                    m.meter_no for m in ami_meters
                ]
                if pick < 1 or pick > len(meter_nos):
                    raise ValueError("out of range")
                meter_no = meter_nos[pick - 1]
            except (ValueError, TypeError, IndexError):
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(ussd_session, "END", "Invalid meter selection.", menu="power_usage")

            report = get_power_usage_report(user, meter_no=meter_no, period="week")
            ok, msg = format_weekly_usage_ussd(report)
            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(
                ussd_session,
                "END",
                msg if ok else f"Error: {msg}",
                menu="power_usage",
            )

        ussd_session.last_text = text
        ussd_session.save(update_fields=["user", "last_text", "updated_at"])
        return _session_reply(ussd_session, "END", "Thank you for using gPawa.")
    except Exception as exc:
        logger.exception("USSD processing error")
        ussd_session.last_text = text
        ussd_session.save(update_fields=["user", "last_text", "updated_at"])
        return _session_reply(
            ussd_session,
            "END",
            f"System error. Please try again later. ({exc.__class__.__name__})",
            menu="error",
        )
