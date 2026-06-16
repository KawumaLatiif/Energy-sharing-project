"""
ERA/UEDCL domestic tariff billing engine.

Block pricing is MONTHLY-CUMULATIVE: the cost of a purchase depends on how many
units the customer has already bought in the current calendar month. A single
purchase can straddle multiple blocks.

Lifeline eligibility (first-15-unit discount at 250 UGX vs 756.2 UGX):
  - Statutory: rolling 6-month average ≤ 100 kWh/month.
  - Pilot: all domestic users are treated as eligible (Profile.lifeline_eligible=True).
  - Switch to real eligibility by calling recompute_lifeline_eligibility(user).
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Optional

from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_active_domestic_tariff(on_date: Optional[date] = None):
    """Return the active DOMESTIC ElectricityTariff for a given date (today if None)."""
    from loan.models import ElectricityTariff

    on_date = on_date or timezone.localdate()

    # Prefer versioned tariffs (effective_from set) over legacy ones
    qs = ElectricityTariff.objects.filter(
        is_active=True,
        tariff_type='DOMESTIC',
    )

    # Versioned: effective_from <= on_date AND (effective_to is null OR effective_to >= on_date)
    versioned = qs.filter(effective_from__isnull=False, effective_from__lte=on_date).filter(
        Q(effective_to__isnull=True) | Q(effective_to__gte=on_date)
    ).order_by('-effective_from').first()

    if versioned:
        return versioned

    # Fall back to any active domestic tariff (legacy, no date range)
    return qs.order_by('-effective_date').first()


def get_monthly_units_consumed(user, month_date: Optional[date] = None) -> Decimal:
    """
    Return total kWh units purchased by user in the calendar month of month_date.
    Reads from meter.Transaction (type=PURCHASE, status=COMPLETED).
    """
    from meter.models import Transaction

    month_date = month_date or timezone.localdate()
    agg = Transaction.objects.filter(
        user=user,
        transaction_type=Transaction.TYPE_PURCHASE,
        status=Transaction.STATUS_COMPLETED,
        create_date__year=month_date.year,
        create_date__month=month_date.month,
    ).aggregate(total=Sum('amount_kwh'))
    return Decimal(str(agg['total'] or 0))


def is_lifeline_eligible(user) -> bool:
    """
    True if the user qualifies for the lifeline rate on the first 15 units.
    Pilot: reads Profile.lifeline_eligible (defaults True for all domestic users).
    Production: call recompute_lifeline_eligibility(user) periodically to update.
    """
    try:
        return user.profile.lifeline_eligible
    except Exception:
        return True  # safe default for pilot


def recompute_lifeline_eligibility(user) -> bool:
    """
    Compute real lifeline eligibility: rolling 6-month average ≤ 100 kWh/month.
    Persists the result to Profile.lifeline_eligible and returns it.
    Call this on a schedule (e.g., monthly) once enough purchase history exists.
    """
    from meter.models import Transaction
    from django.utils.timezone import now
    from dateutil.relativedelta import relativedelta

    six_months_ago = now() - relativedelta(months=6)
    agg = Transaction.objects.filter(
        user=user,
        transaction_type=Transaction.TYPE_PURCHASE,
        status=Transaction.STATUS_COMPLETED,
        create_date__gte=six_months_ago,
    ).aggregate(total=Sum('amount_kwh'))

    total_6m = Decimal(str(agg['total'] or 0))
    avg_monthly = total_6m / 6
    eligible = avg_monthly <= Decimal('100')

    try:
        profile = user.profile
        profile.lifeline_eligible = eligible
        profile.save(update_fields=['lifeline_eligible'])
    except Exception as exc:
        logger.warning("Could not update lifeline_eligible for user %s: %s", user.pk, exc)

    return eligible


def calculate_units_from_cost(
    ugx_amount: Decimal,
    user,
    tariff=None,
    month_date: Optional[date] = None,
) -> tuple[Decimal, bool]:
    """
    Convert a money amount (UGX) to kWh units using the monthly-cumulative block tariff.

    Returns:
        (units: Decimal, lifeline_applied: bool)

    The calculation walks the customer's remaining block allowance for the month,
    consuming as much of ugx_amount as each block can absorb.
    """
    if tariff is None:
        tariff = get_active_domestic_tariff(month_date)

    if tariff is None or not tariff.blocks.exists():
        # No tariff configured — use a safe flat fallback (756.2 UGX/kWh standard rate)
        logger.warning("No active domestic tariff found; using flat 756.2 UGX/kWh fallback")
        return ugx_amount / Decimal('756.2'), False

    already_bought = get_monthly_units_consumed(user, month_date)
    eligible = is_lifeline_eligible(user)

    remaining_cash = ugx_amount
    total_units = Decimal('0')
    lifeline_applied = False

    for block in tariff.blocks.order_by('block_order'):
        if remaining_cash <= 0:
            break

        # Effective rate for this block
        if block.is_lifeline_block:
            if eligible:
                rate = block.rate_per_unit
                lifeline_applied = True
            else:
                rate = block.non_lifeline_rate or Decimal('756.2')
        else:
            rate = block.rate_per_unit

        # How many units of this block has the customer already used this month?
        block_min = Decimal(str(block.min_units))
        block_max = Decimal(str(block.max_units)) if block.max_units is not None else None

        # Units remaining in this block for this customer
        if block_max is not None:
            block_capacity = max(Decimal('0'), block_max - max(already_bought, block_min))
        else:
            block_capacity = None  # unlimited

        if block_capacity is not None and block_capacity <= 0:
            # Customer has exhausted this block for the month
            continue

        # How many units can we buy with remaining_cash in this block?
        if block_capacity is not None:
            max_units_this_block = block_capacity
            max_cost_this_block = max_units_this_block * rate
            cash_for_block = min(remaining_cash, max_cost_this_block)
        else:
            cash_for_block = remaining_cash

        units_from_block = cash_for_block / rate
        total_units += units_from_block
        already_bought += units_from_block
        remaining_cash -= cash_for_block

    return total_units.quantize(Decimal('0.0001')), lifeline_applied


def calculate_cost_from_units(
    units: Decimal,
    user,
    tariff=None,
    month_date: Optional[date] = None,
) -> tuple[Decimal, bool]:
    """
    Calculate the UGX cost to purchase a given number of kWh units.

    Returns:
        (cost_ugx: Decimal, lifeline_applied: bool)
    """
    if tariff is None:
        tariff = get_active_domestic_tariff(month_date)

    if tariff is None or not tariff.blocks.exists():
        logger.warning("No active domestic tariff found; using flat 756.2 UGX/kWh fallback")
        return (units * Decimal('756.2')).quantize(Decimal('0.01')), False

    already_bought = get_monthly_units_consumed(user, month_date)
    eligible = is_lifeline_eligible(user)

    remaining_units = units
    total_cost = Decimal('0')
    lifeline_applied = False

    for block in tariff.blocks.order_by('block_order'):
        if remaining_units <= 0:
            break

        if block.is_lifeline_block:
            if eligible:
                rate = block.rate_per_unit
                lifeline_applied = True
            else:
                rate = block.non_lifeline_rate or Decimal('756.2')
        else:
            rate = block.rate_per_unit

        block_min = Decimal(str(block.min_units))
        block_max = Decimal(str(block.max_units)) if block.max_units is not None else None

        if block_max is not None:
            block_capacity = max(Decimal('0'), block_max - max(already_bought, block_min))
        else:
            block_capacity = None

        if block_capacity is not None and block_capacity <= 0:
            continue

        if block_capacity is not None:
            units_in_block = min(remaining_units, block_capacity)
        else:
            units_in_block = remaining_units

        total_cost += units_in_block * rate
        already_bought += units_in_block
        remaining_units -= units_in_block

    return total_cost.quantize(Decimal('0.01')), lifeline_applied


