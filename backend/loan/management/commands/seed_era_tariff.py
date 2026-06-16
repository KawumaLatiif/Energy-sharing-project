"""
Management command: seed_era_tariff

Seeds the ERA/UEDCL domestic tariff (Code 10.1, Q4-2025 / Q1-2026 rates) into
the ElectricityTariff and TariffBlock tables.

Run once after initial deployment or to add a new quarter's rates:
    python manage.py seed_era_tariff

The command is idempotent — it updates an existing entry if the tariff_code
already exists rather than creating a duplicate.

ERA Domestic Consumer Code 10.1 (low-voltage single-phase, 240V):
  Block 1:  Units  1-15    — UGX 250.0/kWh  (Lifeline; standard rate 756.2 if ineligible)
  Block 2:  Units 16-80    — UGX 756.2/kWh
  Block 3:  Units 81-150   — UGX 412.0/kWh  (Cooking tariff — declining block)
  Block 4:  Units 151+     — UGX 756.2/kWh

Lifeline eligibility: rolling 6-month average ≤ 100 kWh/month.
Pilot: all domestic users default to eligible (Profile.lifeline_eligible=True).
"""
import datetime
from django.core.management.base import BaseCommand
from loan.models import ElectricityTariff, TariffBlock


DOMESTIC_TARIFF = {
    'tariff_code': 'DOM-10.1-2026Q1',
    'tariff_name': 'ERA Domestic Code 10.1 (Q1-2026)',
    'tariff_type': 'DOMESTIC',
    'voltage_level': 'Low Voltage Single Phase',
    'voltage_value': '240V',
    'service_charge': '0.00',
    'is_active': True,
    'effective_from': datetime.date(2026, 1, 1),
    'effective_to': None,  # open-ended until next quarter is seeded
}

BLOCKS = [
    {
        'block_name': 'Lifeline (first 15 units)',
        'min_units': 0,
        'max_units': 15,
        'rate_per_unit': '250.00',
        'block_order': 1,
        'is_lifeline_block': True,
        'non_lifeline_rate': '756.20',  # standard rate when not eligible
    },
    {
        'block_name': 'Standard (16-80 units)',
        'min_units': 16,
        'max_units': 80,
        'rate_per_unit': '756.20',
        'block_order': 2,
        'is_lifeline_block': False,
        'non_lifeline_rate': None,
    },
    {
        'block_name': 'Cooking tariff (81-150 units)',
        'min_units': 81,
        'max_units': 150,
        'rate_per_unit': '412.00',
        'block_order': 3,
        'is_lifeline_block': False,
        'non_lifeline_rate': None,
    },
    {
        'block_name': 'Standard (above 150 units)',
        'min_units': 151,
        'max_units': None,
        'rate_per_unit': '756.20',
        'block_order': 4,
        'is_lifeline_block': False,
        'non_lifeline_rate': None,
    },
]


class Command(BaseCommand):
    help = 'Seed the ERA/UEDCL domestic tariff (Code 10.1) into the database'

    def handle(self, *args, **options):
        tariff, created = ElectricityTariff.objects.update_or_create(
            tariff_code=DOMESTIC_TARIFF['tariff_code'],
            defaults=DOMESTIC_TARIFF,
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(f'{action} tariff: {tariff}')

        for block_data in BLOCKS:
            block, b_created = TariffBlock.objects.update_or_create(
                tariff=tariff,
                block_order=block_data['block_order'],
                defaults=block_data,
            )
            b_action = 'Created' if b_created else 'Updated'
            self.stdout.write(f'  {b_action} block: {block}')

        self.stdout.write(self.style.SUCCESS(
            '\nERA domestic tariff seeded successfully.\n'
            'Run "python manage.py seed_era_tariff" again each quarter '
            'to add new rate bands (close the previous effective_to first).'
        ))
