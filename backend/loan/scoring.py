import random
from types import SimpleNamespace

from django.db.utils import OperationalError, ProgrammingError
from loan.models import UserCreditSignal


# Requested factor weights: 1, 2, 3
FACTOR_WEIGHTS = {
    'payment_history': 1,
    'energy_consumption': 2,
    'financial_capacity': 3,
}

PAYMENT_HISTORY_SCORES = {
    'GOOD': 100,
    'FAIR': 65,
    'POOR': 30,
}

ENERGY_CONSUMPTION_SCORES = {
    'STABLE': 100,
    'MODERATE': 70,
    'ERRATIC': 35,
}

FINANCIAL_CAPACITY_SCORES = {
    'STRONG': 100,
    'AVERAGE': 65,
    'WEAK': 30,
}


def get_or_create_dummy_credit_signal(user):
    """
    Simulate third-party enrichment.
    Creates one persistent dummy signal record per user when missing.
    """
    defaults = {
        'payment_history': random.choice(['GOOD', 'FAIR', 'POOR']),
        'energy_consumption': random.choice(['STABLE', 'MODERATE', 'ERRATIC']),
        'financial_capacity': random.choice(['STRONG', 'AVERAGE', 'WEAK']),
        'source': 'DUMMY_THIRD_PARTY',
    }
    try:
        signal, _ = UserCreditSignal.objects.get_or_create(user=user, defaults=defaults)
        return signal
    except (OperationalError, ProgrammingError):
        # Fallback when migration hasn't been applied yet.
        return SimpleNamespace(**defaults)


def calculate_weighted_credit_score(signal):
    """Return integer credit score (0-100) from weighted 3-factor model."""
    weighted_total = (
        PAYMENT_HISTORY_SCORES.get(signal.payment_history, 0) * FACTOR_WEIGHTS['payment_history']
        + ENERGY_CONSUMPTION_SCORES.get(signal.energy_consumption, 0) * FACTOR_WEIGHTS['energy_consumption']
        + FINANCIAL_CAPACITY_SCORES.get(signal.financial_capacity, 0) * FACTOR_WEIGHTS['financial_capacity']
    )
    total_weight = sum(FACTOR_WEIGHTS.values())
    return round(weighted_total / total_weight) if total_weight else 0
