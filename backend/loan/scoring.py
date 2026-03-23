import random
from types import SimpleNamespace

from django.db.utils import OperationalError, ProgrammingError
from loan.models import UserCreditSignal


# Major factor weights 
FACTOR_WEIGHTS = {
    'payment_history': 1,
    'energy_consumption': 2,
    'financial_capacity': 3,
}

# Each major factor is now composed of granular sub-factors.
# Scores are on a 0-100 scale; they are intentionally conservative on mid/low categories.
FACTOR_SUBFACTORS = {
    'payment_history': {
        'weights': {'on_time_ratio': 0.5, 'arrears_frequency': 0.3, 'disconnection_events': 0.2},
        'scores': {
            'GOOD':     {'on_time_ratio': 95, 'arrears_frequency': 90, 'disconnection_events': 90},
            'FAIR':     {'on_time_ratio': 75, 'arrears_frequency': 60, 'disconnection_events': 55},
            'POOR':     {'on_time_ratio': 45, 'arrears_frequency': 35, 'disconnection_events': 30},
        }
    },
    'energy_consumption': {
        'weights': {'usage_stability': 0.4, 'peak_variation': 0.35, 'seasonality': 0.25},
        'scores': {
            'STABLE':   {'usage_stability': 95, 'peak_variation': 90, 'seasonality': 90},
            'MODERATE': {'usage_stability': 75, 'peak_variation': 70, 'seasonality': 65},
            'ERRATIC':  {'usage_stability': 45, 'peak_variation': 40, 'seasonality': 35},
        }
    },
    'financial_capacity': {
        'weights': {'income_stability': 0.4, 'expense_buffer': 0.35, 'repayment_capacity': 0.25},
        'scores': {
            'STRONG':  {'income_stability': 95, 'expense_buffer': 90, 'repayment_capacity': 90},
            'AVERAGE': {'income_stability': 75, 'expense_buffer': 70, 'repayment_capacity': 65},
            'WEAK':    {'income_stability': 45, 'expense_buffer': 40, 'repayment_capacity': 35},
        }
    }
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


def _score_subfactors(choice_value, factor_key):
    """Compute the average score for a major factor using its sub-factors."""
    factor_cfg = FACTOR_SUBFACTORS[factor_key]
    sub_scores = factor_cfg['scores'].get(choice_value, {})
    weights = factor_cfg['weights']

    weighted_sum = sum(sub_scores.get(sub, 0) * weight for sub, weight in weights.items())
    total_weight = sum(weights.values()) or 1
    return round(weighted_sum / total_weight)


def get_factor_breakdown(signal):
    """
    Return granular scores for each factor and its sub-factors.
    Example:
    {
        'factor_scores': {'payment_history': 88, ...},
        'subfactor_scores': {
            'payment_history': {'on_time_ratio': 95, ...},
            ...
        }
    }
    """
    factor_scores = {}
    subfactor_scores = {}

    for factor_key in FACTOR_SUBFACTORS.keys():
        choice_value = getattr(signal, factor_key, None)
        factor_cfg = FACTOR_SUBFACTORS[factor_key]

        # Capture subfactor scores
        sub_scores = factor_cfg['scores'].get(choice_value, {})
        subfactor_scores[factor_key] = sub_scores

        # Compute the aggregate score for this factor
        factor_scores[factor_key] = _score_subfactors(choice_value, factor_key)

    return {
        'factor_scores': factor_scores,
        'subfactor_scores': subfactor_scores,
    }


def calculate_weighted_credit_score(signal):
    """
    Return integer credit score (0-100) from weighted 3-factor model
    built from granular sub-factors.
    """
    breakdown = get_factor_breakdown(signal)
    factor_scores = breakdown['factor_scores']

    weighted_total = sum(
        factor_scores.get(factor, 0) * weight
        for factor, weight in FACTOR_WEIGHTS.items()
    )
    total_weight = sum(FACTOR_WEIGHTS.values()) or 1
    return round(weighted_total / total_weight)
