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
from loan.models import ElectricityTariff, LoanApplication, LoanDisbursement, LoanRepayment
from loan.scoring import calculate_weighted_credit_score, get_or_create_dummy_credit_signal
from loan.models import get_tier_by_score
from meter.api.views import BuyUnitsView
from meter.models import Meter, MeterToken
from share.models import ShareTransaction
from share.services import VerificationCode
from transactions.models import Transaction, TransactionLog, TransactionType, UnitTransaction
from transactions.api.generate_token import generate_numeric_token
from ussd.models import UssdSession
from wallet.models import Wallet as UnitWallet

logger = logging.getLogger(__name__)


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in str(phone or "") if ch.isdigit())


def _find_user_by_phone(phone_number: str):
    from accounts.models import User

    incoming = _normalize_phone(phone_number)
    if not incoming:
        return None

    # Tolerate provider formatting differences (+256..., 256..., 07...)
    for user in User.objects.all().only("id", "phone_number"):
        stored = _normalize_phone(user.phone_number)
        if not stored:
            continue
        if stored == incoming or stored.endswith(incoming[-9:]) or incoming.endswith(stored[-9:]):
            return user
    return None


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


def _latest_approved_loan(user):
    return LoanApplication.objects.filter(user=user, status="APPROVED").order_by("-created_at").first()


def _start_buy_units(user, phone_number: str, amount_raw: str):
    meter = Meter.objects.filter(user=user).first()
    if not meter:
        return False, "No meter found. Register your meter in app first."

    active_loans = LoanApplication.objects.filter(user=user).exclude(status__in=["COMPLETED", "REJECTED"])
    if active_loans.exists():
        return False, "You cannot buy units while you have an active loan."

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
    _, total_outstanding = buy_view._get_active_loan_balances(user)
    estimated_buy_amount = max(Decimal("0"), amount - total_outstanding)
    estimated_units, tariff = buy_view._calculate_units_from_tariff(estimated_buy_amount)

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
    meter = Meter.objects.filter(user=user).first()
    if not meter:
        return False, "No meter found. Register your meter in app first."

    active_exists = LoanApplication.objects.filter(
        user=user, status__in=["PENDING", "APPROVED", "DISBURSED"]
    ).exists()
    if active_exists:
        return False, "You already have an active loan."

    try:
        amount_requested = Decimal(amount_raw)
    except (InvalidOperation, ValueError):
        return False, "Invalid amount."

    if amount_requested < Decimal("5000") or amount_requested > Decimal("200000"):
        return False, "Amount out of range. Use 5000 to 200000."

    credit_signal = get_or_create_dummy_credit_signal(user)
    score = max(0, min(calculate_weighted_credit_score(credit_signal), 100))
    tier_info = get_tier_by_score(score)
    tariff = ElectricityTariff.objects.filter(is_active=True).first()

    if tier_info:
        max_amount = Decimal(str(tier_info["max_amount"]))
        approved = min(max_amount, amount_requested)
        status_value = "APPROVED" if approved > 0 else "REJECTED"
        rejection_reason = "" if approved > 0 else "Credit score below threshold"
        tier_name = str(tier_info["name"]).upper()
        interest_rate = tier_info["interest_rate"]
    else:
        approved = Decimal("0")
        status_value = "REJECTED"
        rejection_reason = "Credit score below threshold"
        tier_name = None
        interest_rate = Decimal("10.0")

    loan = LoanApplication.objects.create(
        user=user,
        purpose="USSD application",
        amount_requested=amount_requested,
        amount_approved=approved if approved > 0 else None,
        tenure_months=1,
        credit_score=int(score),
        loan_tier=tier_name,
        interest_rate=interest_rate,
        tariff=tariff,
        status=status_value,
        rejection_reason=rejection_reason,
    )

    TransactionLog.objects.create(
        user=user,
        transaction_type=TransactionType.LOAN_APPLICATION,
        amount=amount_requested,
        status=loan.status,
        reference_id=loan.loan_id,
        details={"channel": "USSD"},
    )

    if loan.status == "APPROVED":
        return True, f"Loan approved.\nID: {loan.id}\nLoanRef: {loan.loan_id}\nApproved UGX {loan.amount_approved}"
    return True, f"Loan rejected.\nReason: {loan.rejection_reason}"


def _disburse_loan(user, loan_id_raw: str):
    if loan_id_raw == "0":
        loan = _latest_approved_loan(user)
    else:
        try:
            loan = LoanApplication.objects.get(id=int(loan_id_raw), user=user)
        except (ValueError, LoanApplication.DoesNotExist):
            return False, "Loan not found."

    if not loan:
        return False, "No approved loan found."
    if loan.status != "APPROVED":
        return False, f"Loan is {loan.status}. Only APPROVED loans can be disbursed."
    if not loan.amount_approved or loan.amount_approved <= 0:
        return False, "Loan amount not approved."

    meter = Meter.objects.filter(user=user).first()
    if not meter:
        return False, "No meter found."

    with db_transaction.atomic():
        if loan.tariff:
            units_to_disburse = loan.calculate_units_from_amount()
        else:
            units_to_disburse = round(float(loan.amount_approved) / 500)

        LoanDisbursement.objects.create(
            loan_application=loan,
            disbursed_amount=loan.amount_approved,
            units_disbursed=units_to_disburse,
            meter=meter,
        )

        loan.status = "DISBURSED"
        loan.save()

        unit_wallet, _ = UnitWallet.objects.get_or_create(user=user)
        unit_wallet.balance += Decimal(str(units_to_disburse))
        unit_wallet.save()

        TransactionLog.objects.create(
            user=user,
            transaction_type=TransactionType.LOAN_DISBURSEMENT,
            amount=loan.amount_approved,
            units=units_to_disburse,
            status="COMPLETED",
            reference_id=loan.loan_id,
            details={"channel": "USSD"},
        )

    return True, f"Loan disbursed.\nLoanRef: {loan.loan_id}\nUnits added: {round(units_to_disburse, 2)}"


def _repay_loan(user, loan_id_raw: str, amount_raw: str):
    try:
        loan = LoanApplication.objects.get(id=int(loan_id_raw), user=user)
    except (ValueError, LoanApplication.DoesNotExist):
        return False, "Loan not found."

    if loan.status != "DISBURSED":
        return False, "Loan is not disbursed."

    try:
        amount = Decimal(str(amount_raw))
    except (InvalidOperation, ValueError):
        return False, "Invalid amount."
    if amount <= 0:
        return False, "Amount must be greater than zero."

    current_balance = Decimal(str(loan.outstanding_balance))
    if amount > current_balance:
        return False, f"Amount exceeds outstanding balance UGX {current_balance}."

    with db_transaction.atomic():
        if loan.tariff:
            units_equivalent = loan.calculate_units_from_amount(float(amount))
        else:
            units_equivalent = round(float(amount) / 500, 2)

        repayment = LoanRepayment.objects.create(
            loan=loan,
            amount_paid=amount,
            units_paid=units_equivalent,
            payment_reference=f"USSD-{uuid.uuid4().hex[:10].upper()}",
            is_on_time=True if not loan.due_date else timezone.now() <= loan.due_date,
            payment_method="MOBILE_MONEY",
            payment_status="SUCCESS",
        )

        unit_wallet, _ = UnitWallet.objects.get_or_create(user=user)
        unit_wallet.balance += Decimal(str(units_equivalent))
        unit_wallet.save()

        TransactionLog.objects.create(
            user=user,
            transaction_type=TransactionType.LOAN_REPAYMENT,
            amount=amount,
            units=units_equivalent,
            status="COMPLETED",
            reference_id=loan.loan_id,
            details={"payment_reference": repayment.payment_reference, "channel": "USSD"},
        )

        loan.refresh_from_db()
        if loan.outstanding_balance <= 0:
            loan.status = "COMPLETED"
            loan.save()

    return True, (
        f"Repayment successful.\nLoanRef: {loan.loan_id}\nPaid: UGX {amount}\n"
        f"Outstanding: UGX {loan.outstanding_balance}\nWallet +{round(units_equivalent, 2)} units"
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

    VerificationCode.create_code(user=user, purpose="share_units", expiry_minutes=10)
    return True, f"Share initiated.\nRef: {tx_ref}\nEnter OTP via Share->Verify."


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

        is_self_share = pending.meter_send_id == pending.meter_receive_id
        if is_self_share:
            token = generate_numeric_token()
            MeterToken.objects.create(
                token=token,
                units=pending.units,
                meter=pending.meter_receive,
                user=pending.receiver,
                is_used=False,
                source="SHARE",
                share_transaction_id=pending.share_transaction_id,
                share_sender=user,
            )
            msg_suffix = f"Token: {token}"
        else:
            receiver_wallet, _ = UnitWallet.objects.select_for_update().get_or_create(user=pending.receiver)
            receiver_wallet.add(
                pending.units,
                description=f"USSD share from {pending.meter_send.meter_no}",
                transaction_ref=pending.share_transaction_id,
            )
            msg_suffix = "Receiver wallet credited."

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

    return True, f"Share completed.\nRef: {pending.share_transaction_id}\nUnits: {pending.units}\n{msg_suffix}"


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
                    "Power Cred\n"
                    "1. Wallet & Meter\n"
                    "2. Buy Units\n"
                    "3. Loans\n"
                    "4. Share Units\n"
                    "5. My Tokens\n"
                    "6. Exit"
                ),
                menu="root",
            )

        # 1) Wallet and meter overview
        if steps[0] == "1":
            active_loans = LoanApplication.objects.filter(user=user, status="DISBURSED")
            outstanding = sum(Decimal(str(loan.outstanding_balance)) for loan in active_loans)
            meter_no = meter.meter_no if meter else "Not registered"
            ussd_session.last_text = text
            ussd_session.save(update_fields=["user", "last_text", "updated_at"])
            return _session_reply(
                ussd_session,
                "END",
                f"Wallet: {wallet.balance} units\nMeter: {meter_no}\nOutstanding loan: UGX {outstanding}",
                menu="wallet_overview",
            )

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
                loans = LoanApplication.objects.filter(user=user)
                pending = loans.filter(status="PENDING").count()
                active = loans.filter(status__in=["APPROVED", "DISBURSED", "DEFAULTED"]).count()
                outstanding = sum(float(l.outstanding_balance) for l in loans.exclude(status__in=["COMPLETED", "REJECTED"]))
                ussd_session.last_text = text
                ussd_session.save(update_fields=["user", "last_text", "updated_at"])
                return _session_reply(
                    ussd_session,
                    "END",
                    f"Loan stats\nPending: {pending}\nActive: {active}\nOutstanding: UGX {round(outstanding, 2)}",
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

        # 5) Token lookup
        if steps[0] == "5":
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

        ussd_session.last_text = text
        ussd_session.save(update_fields=["user", "last_text", "updated_at"])
        return _session_reply(ussd_session, "END", "Thank you for using Power Cred.")
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
