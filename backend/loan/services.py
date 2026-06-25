"""
Shared loan business logic — single source of truth for web API and USSD.

All channels must call these helpers so loan detection, blocking rules, and
mutations stay aligned with the web portal (`loan.api.views`).
"""
from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from accounts.models import generate_random_string
from loan.models import ElectricityTariff, LoanApplication, LoanDisbursement, LoanRepayment, get_tier_by_score
from loan.scoring import calculate_weighted_credit_score, get_or_create_credit_signal
from meter.models import Meter, MeterNotification
from meter.notifications import create_system_notification
from meter.services import push_units_to_thingsboard
from transactions.models import TransactionLog, TransactionType, UnitTransaction
from utils.general import dispatch_task
from loan.tenure import validate_tenure_months
from utils.billing import get_active_domestic_tariff
from wallet.models import Wallet as UnitWallet
from accounts.tasks import (
    handle_send_loan_application_email,
    handle_send_loan_disbursed_email,
)

logger = logging.getLogger(__name__)

# Status sets aligned with `LoanApplicationView.create` and `BuyUnitsView.post`
APPLY_BLOCK_STATUSES = ("PENDING", "APPROVED", "DISBURSED")
TERMINAL_LOAN_STATUSES = ("COMPLETED", "REJECTED")
ACTIVE_LOAN_STATUSES = ("APPROVED", "DISBURSED", "DEFAULTED")

PURCHASE_BLOCK_MESSAGE = (
    "You cannot buy units while you have a pending or incomplete loan. "
    "Please clear your loan first."
)
APPLY_BLOCK_MESSAGE = (
    "You already have an active loan. Please complete repayment before applying for a new one."
)

PLATFORM_MAX_LOAN = 200_000
MIN_LOAN_AMOUNT = 5_000
MIN_LOAN_CREDIT_SCORE = 75


class LoanOperationError(Exception):
    """Raised when a loan action is not allowed or fails validation."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def incomplete_loans_queryset(user):
    return LoanApplication.objects.filter(user=user).exclude(status__in=TERMINAL_LOAN_STATUSES)


def user_can_apply_for_loan(user) -> tuple[bool, str]:
    if LoanApplication.objects.filter(user=user, status__in=APPLY_BLOCK_STATUSES).exists():
        return False, APPLY_BLOCK_MESSAGE
    return True, ""


def user_can_purchase_units(user) -> tuple[bool, str]:
    if incomplete_loans_queryset(user).exists():
        return False, PURCHASE_BLOCK_MESSAGE
    return True, ""


def get_loan_eligibility(user) -> dict:
    """Credit score, tier, and amount caps used by web, USSD, and stats API."""
    credit_signal = get_or_create_credit_signal(user)
    credit_score = max(0, min(calculate_weighted_credit_score(credit_signal), 100))
    tier_info = _determine_loan_tier(credit_score)

    if tier_info:
        loan_tier, max_eligible_amount, interest_rate = tier_info
    else:
        loan_tier = None
        max_eligible_amount = 0
        interest_rate = None

    is_eligible = credit_score >= MIN_LOAN_CREDIT_SCORE and max_eligible_amount > 0

    return {
        "credit_score": credit_score,
        "loan_tier": loan_tier,
        "max_eligible_amount": int(max_eligible_amount),
        "platform_max_loan": PLATFORM_MAX_LOAN,
        "min_loan_amount": MIN_LOAN_AMOUNT,
        "min_credit_score": MIN_LOAN_CREDIT_SCORE,
        "is_loan_eligible": is_eligible,
        "interest_rate": float(interest_rate) if interest_rate is not None else None,
        "credit_signal_source": getattr(credit_signal, "source", None),
        "profile_complete_for_scoring": _user_has_profile_for_scoring(user),
    }


def _user_has_profile_for_scoring(user) -> bool:
    from loan.scoring import _user_has_profile_signals

    return _user_has_profile_signals(user)


def get_user_loan_stats(user) -> dict:
    """Same payload as ``GET /api/v1/loans/stats/``."""
    loans = LoanApplication.objects.filter(user=user)

    pending_applications = loans.filter(status="PENDING").count()
    active_loans = loans.filter(status__in=ACTIVE_LOAN_STATUSES).count()
    approved_loans = loans.filter(status="APPROVED").count()
    total_loans = loans.count()

    total_borrowed = float(
        loans.filter(status__in=["APPROVED", "DISBURSED", "COMPLETED", "DEFAULTED"])
        .aggregate(total=Sum("amount_approved"))["total"]
        or 0
    )

    total_repayments = float(
        LoanRepayment.objects.filter(loan__user=user)
        .aggregate(total=Sum("amount_paid"))["total"]
        or 0
    )

    outstanding_balance = sum(
        float(loan.outstanding_balance)
        for loan in loans.exclude(status__in=TERMINAL_LOAN_STATUSES)
    )

    eligibility = get_loan_eligibility(user)
    repayable = get_repayable_loan(user)

    return {
        "active_loans": active_loans,
        "pending_applications": pending_applications,
        "approved_loans": approved_loans,
        "total_loans": total_loans,
        "total_borrowed": total_borrowed,
        "total_repayments": total_repayments,
        "outstanding_balance": outstanding_balance,
        "has_blocking_loan": (
            active_loans > 0 or pending_applications > 0 or outstanding_balance > 0
        ),
        "repayable_loan": serialize_repayable_loan(repayable),
        **eligibility,
    }


def get_disbursed_loan_balances(user):
    """Mirrors ``BuyUnitsView._get_active_loan_balances``."""
    loans_with_balance = []
    total_outstanding = Decimal("0")
    for loan in LoanApplication.objects.filter(user=user, status="DISBURSED").order_by(
        "created_at"
    ):
        balance = Decimal(str(loan.outstanding_balance))
        if balance > 0:
            loans_with_balance.append((loan, balance))
            total_outstanding += balance
    return loans_with_balance, total_outstanding


def get_repayable_loan(user):
    """Most recent disbursed loan with an outstanding balance."""
    for loan in LoanApplication.objects.filter(user=user, status="DISBURSED").order_by(
        "-created_at"
    ):
        if float(loan.outstanding_balance) > 0:
            return loan
    return None


def serialize_repayable_loan(loan: LoanApplication | None) -> dict | None:
    if not loan:
        return None
    return {
        "id": loan.id,
        "loan_id": loan.loan_id,
        "outstanding_balance": float(loan.outstanding_balance),
        "amount_approved": float(loan.amount_approved or 0),
        "due_date": loan.due_date.isoformat() if loan.due_date else None,
    }


def format_repay_loan_menu_ussd(loan: LoanApplication) -> str:
    balance = round(float(loan.outstanding_balance), 2)
    return (
        f"Repay loan\n"
        f"Ref: {loan.loan_id}\n"
        f"Outstanding: UGX {balance:,.2f}\n"
        f"1. Pay full amount\n"
        f"2. Pay partial amount"
    )


def _determine_loan_tier(score):
    tier_info = get_tier_by_score(score)
    if tier_info:
        return tier_info["name"], tier_info["max_amount"], tier_info["interest_rate"]
    return None


def create_loan_application(
    user,
    *,
    amount_requested,
    purpose: str,
    tenure_months: int = 6,
    channel: str = "WEB",
) -> LoanApplication:
    """
    Same rules as ``LoanApplicationView.create`` (web loan apply).
    """
    can_apply, msg = user_can_apply_for_loan(user)
    if not can_apply:
        raise LoanOperationError(msg)

    if not Meter.objects.filter(user=user).exists():
        raise LoanOperationError(
            "No meter found. Please register your meter before applying for a loan."
        )

    try:
        amount_requested = Decimal(str(amount_requested))
    except (InvalidOperation, TypeError, ValueError):
        raise LoanOperationError("Invalid amount.")

    if amount_requested < Decimal("5000") or amount_requested > Decimal("200000"):
        raise LoanOperationError("Amount out of range. Use 5000 to 200000.")

    try:
        tenure_months = validate_tenure_months(tenure_months)
    except ValueError as exc:
        raise LoanOperationError(str(exc)) from exc

    tariff = get_active_domestic_tariff()
    credit_signal = get_or_create_credit_signal(user)
    credit_score = max(0, min(calculate_weighted_credit_score(credit_signal), 100))
    tier_info = _determine_loan_tier(credit_score)

    if credit_score < MIN_LOAN_CREDIT_SCORE or not tier_info:
        raise LoanOperationError(
            f"Credit score {credit_score}/100 is below the minimum {MIN_LOAN_CREDIT_SCORE}. "
            "Complete your profile on the web portal to improve eligibility."
        )

    if tier_info:
        tier_name, max_amount, interest_rate = tier_info
        amount_approved = min(Decimal(str(max_amount)), amount_requested)
    else:
        amount_approved = Decimal("0")
        tier_name = None
        interest_rate = Decimal("10.0")

    status_value = "APPROVED" if amount_approved > 0 else "REJECTED"
    rejection_reason = "" if amount_approved > 0 else "Credit score below 75%"

    loan = LoanApplication.objects.create(
        user=user,
        purpose=purpose,
        amount_requested=amount_requested,
        amount_approved=amount_approved if amount_approved > 0 else None,
        tenure_months=tenure_months,
        credit_score=int(credit_score),
        loan_tier=str(tier_name).upper() if tier_name else None,
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
        details={
            "channel": channel,
            "purpose": purpose,
            "tenure_months": tenure_months,
            "credit_score": credit_score,
            "loan_tier": tier_name,
            "amount_approved": float(amount_approved) if amount_approved else 0,
        },
    )
    create_system_notification(
        user=user,
        notification_type=MeterNotification.TYPE_LOAN_APPLICATION,
        message=(
            f"Loan application {loan.loan_id}: {loan.status}. "
            f"Requested UGX {float(amount_requested):,.2f}, "
            f"approved UGX {float(amount_approved):,.2f}."
        ),
        units_kwh=Decimal("0"),
    )
    dispatch_task(
        handle_send_loan_application_email,
        user.id,
        loan.loan_id,
        loan.status,
        float(amount_requested),
        float(amount_approved or 0),
    )

    return loan


def _resolve_loan_for_disburse(user, loan_id=None):
    if loan_id in (None, "", "0", 0):
        loan = (
            LoanApplication.objects.filter(user=user, status="APPROVED")
            .order_by("-created_at")
            .first()
        )
    else:
        try:
            loan = LoanApplication.objects.get(id=int(loan_id), user=user)
        except (ValueError, LoanApplication.DoesNotExist):
            raise LoanOperationError("Loan not found.") from None
    return loan


def disburse_loan(user, loan_id=None, *, channel: str = "WEB") -> dict:
    """Same rules as ``LoanDisbursementView.post``."""
    loan = _resolve_loan_for_disburse(user, loan_id)
    if not loan:
        raise LoanOperationError("No approved loan found.")
    if loan.status != "APPROVED":
        raise LoanOperationError(f"Loan is {loan.status}. Only APPROVED loans can be disbursed.")
    if not loan.amount_approved or loan.amount_approved <= 0:
        raise LoanOperationError("Loan amount not approved.")

    meter = Meter.objects.filter(user=user).first()
    if not meter:
        raise LoanOperationError("No meter found.")

    with transaction.atomic():
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

        push_ok, push_msg = push_units_to_thingsboard(
            meter=meter,
            units=units_to_disburse,
            reference_id=loan.loan_id,
        )

        TransactionLog.objects.create(
            user=user,
            transaction_type=TransactionType.LOAN_DISBURSEMENT,
            amount=loan.amount_approved,
            units=units_to_disburse,
            status="COMPLETED",
            reference_id=loan.loan_id,
            details={
                "channel": channel,
                "units_disbursed": float(units_to_disburse),
                "meter_push": {"status": "OK" if push_ok else "FAILED", "message": push_msg},
            },
        )

        try:
            UnitTransaction.objects.create(
                sender=user,
                receiver=user,
                units=units_to_disburse,
                direction="IN",
                status="COMPLETED",
                message=f"Loan disbursement to wallet - {loan.loan_id}",
            )
        except Exception as exc:
            logger.warning("UnitTransaction creation failed during disbursement: %s", exc)
    create_system_notification(
        user=user,
        notification_type=MeterNotification.TYPE_LOAN_DISBURSEMENT,
        meter=meter,
        message=(
            f"Loan {loan.loan_id} disbursed: {round(float(units_to_disburse), 2):.2f} kWh "
            f"credited to wallet."
        ),
        units_kwh=Decimal("0"),
    )
    dispatch_task(
        handle_send_loan_disbursed_email,
        user.id,
        loan.loan_id,
        float(loan.amount_approved or 0),
        float(units_to_disburse),
    )

    return {
        "loan_id": loan.loan_id,
        "loan_pk": loan.id,
        "units_disbursed": round(float(units_to_disburse), 2),
        "meter_push_ok": push_ok,
        "meter_push_message": push_msg,
    }


def _payment_on_time(loan) -> bool:
    if not loan.due_date:
        return True
    return timezone.now() <= loan.due_date


def _resolve_loan_for_repay(user, loan_id=None):
    if loan_id in (None, "", "0", 0):
        loan = get_repayable_loan(user)
        if not loan:
            raise LoanOperationError("No active loan to repay.")
        return loan
    try:
        return LoanApplication.objects.get(id=int(loan_id), user=user)
    except (ValueError, LoanApplication.DoesNotExist):
        raise LoanOperationError("Loan not found.") from None


def repay_loan(
    user,
    loan_id,
    amount,
    *,
    channel: str = "WEB",
    payment_method: str = "CASH",
) -> dict:
    """Same rules as ``LoanRepaymentView.post`` (web repayment)."""
    loan = _resolve_loan_for_repay(user, loan_id)

    if loan.status != "DISBURSED":
        raise LoanOperationError("Loan is not disbursed or already completed")

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        raise LoanOperationError("Invalid amount.")

    if amount <= 0:
        raise LoanOperationError("Invalid amount")

    current_balance = loan.outstanding_balance
    if amount > current_balance:
        raise LoanOperationError(
            f"Amount exceeds outstanding balance of {current_balance} UGX"
        )

    if loan.tariff:
        units_equivalent = loan.calculate_units_from_amount(amount)
    else:
        units_equivalent = round(amount / 500, 2)

    with transaction.atomic():
        payment_ref = generate_random_string(12)
        LoanRepayment.objects.create(
            loan=loan,
            amount_paid=amount,
            units_paid=units_equivalent,
            payment_reference=payment_ref,
            is_on_time=_payment_on_time(loan),
            payment_method=payment_method,
            payment_status="SUCCESS",
        )

        try:
            meter = Meter.objects.get(user=user)
            meter.units += units_equivalent
            meter.save()
        except Meter.DoesNotExist:
            raise LoanOperationError("Meter not found") from None

        TransactionLog.objects.create(
            user=user,
            transaction_type=TransactionType.LOAN_REPAYMENT,
            amount=amount,
            units=units_equivalent,
            status="COMPLETED",
            reference_id=loan.loan_id,
            details={
                "channel": channel,
                "payment_reference": payment_ref,
                "units_added": float(units_equivalent),
                "loan_id": loan.loan_id,
                "payment_method": payment_method,
            },
        )

        try:
            UnitTransaction.objects.create(
                sender=user,
                receiver=user,
                units=units_equivalent,
                meter=meter,
                direction="IN",
                status="COMPLETED",
                message=f"Loan repayment for {loan.loan_id}",
            )
        except Exception as exc:
            logger.warning("UnitTransaction creation failed during repayment: %s", exc)

        loan.refresh_from_db()
        message = "Payment successful"
        if loan.outstanding_balance <= 0:
            loan.status = "COMPLETED"
            loan.save()
            TransactionLog.objects.create(
                user=user,
                transaction_type=TransactionType.LOAN_COMPLETION,
                amount=0,
                status="COMPLETED",
                reference_id=loan.loan_id,
                details={"message": "Loan fully repaid", "channel": channel},
            )
            message = "Loan fully repaid! Thank you."

    loan.refresh_from_db()
    return {
        "message": message,
        "loan_id": loan.loan_id,
        "units_added": round(float(units_equivalent), 2),
        "outstanding_balance": loan.outstanding_balance,
        "loan_status": loan.status,
        "payment_reference": payment_ref,
    }


def format_loan_stats_ussd(stats: dict) -> str:
    blocking = "Yes" if stats.get("has_blocking_loan") else "No"
    score = stats.get("credit_score", 0)
    tier = stats.get("loan_tier") or "None"
    eligible = stats.get("max_eligible_amount", 0)
    platform_max = stats.get("platform_max_loan", PLATFORM_MAX_LOAN)
    return (
        f"Loan stats\n"
        f"Credit score: {score}/100\n"
        f"Tier: {tier}\n"
        f"Your limit: UGX {eligible:,}\n"
        f"Platform max: UGX {platform_max:,}\n"
        f"Pending: {stats['pending_applications']}\n"
        f"Active: {stats['active_loans']}\n"
        f"Outstanding: UGX {round(stats['outstanding_balance'], 2)}\n"
        f"Blocking purchases: {blocking}"
    )


def format_loan_apply_preview_ussd(stats: dict) -> str:
    score = stats.get("credit_score", 0)
    min_score = stats.get("min_credit_score", MIN_LOAN_CREDIT_SCORE)
    tier = stats.get("loan_tier") or "None"
    eligible = stats.get("max_eligible_amount", 0)
    platform_max = stats.get("platform_max_loan", PLATFORM_MAX_LOAN)

    if not stats.get("is_loan_eligible"):
        profile_hint = (
            "Complete profile on web to improve score."
            if not stats.get("profile_complete_for_scoring")
            else "Score below minimum."
        )
        return (
            f"Apply for loan\n"
            f"Score: {score}/100 (min {min_score})\n"
            f"Not eligible yet.\n"
            f"{profile_hint}"
        )

    return (
        f"Apply for loan\n"
        f"Score: {score}/100\n"
        f"Tier: {tier}\n"
        f"Your limit: UGX {eligible:,}\n"
        f"Platform max: UGX {platform_max:,}\n"
        f"Enter amount UGX ({MIN_LOAN_AMOUNT}-{eligible}):"
    )


def format_wallet_loan_summary(stats: dict) -> str:
    if not stats.get("has_blocking_loan"):
        return "Loans: none active"
    parts = []
    if stats["pending_applications"]:
        parts.append(f"{stats['pending_applications']} pending")
    if stats["active_loans"]:
        parts.append(f"{stats['active_loans']} active")
    label = ", ".join(parts) if parts else "open"
    return f"Loans: {label}\nOutstanding: UGX {round(stats['outstanding_balance'], 2)}"
