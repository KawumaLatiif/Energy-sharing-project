"""
Management command: seed_era_tariff

Seeds the ERA/UEDCL domestic tariff (Code 10.1, Q4 2025 / current rates) into
the ElectricityTariff and TariffBlock tables.

Run once after initial deployment or to add a new quarter's rates:
    python manage.py seed_era_tariff

ERA Domestic Consumer Code 10.1:
  Block 1:  Units  1-15    — UGX 250.0/kWh  (Lifeline; 756.2 if ineligible)
  Block 2:  Units 16-80    — UGX 756.2/kWh
  Block 3:  Units 81-150   — UGX 412.0/kWh  (Cooking tariff)
  Block 4:  Units 151+     — UGX 756.0/kWh  (Super normal)

Service charge: UGX 3,360/month | VAT: 18% (applied in utils.billing).
"""
import datetime
from django.core.management.base import BaseCommand
from loan.models import ElectricityTariff, TariffBlock


# Primary tariff for 2026 (current pilot); rates per ERA Q4 2025 domestic summary
DOMESTIC_TARIFF = {
    "tariff_code": "DOM-10.1-2026Q1",
    "tariff_name": "ERA Domestic Code 10.1 (Q1 2026)",
    "tariff_type": "DOMESTIC",
    "voltage_level": "Low Voltage Single Phase",
    "voltage_value": "240V",
    "service_charge": "3360.00",
    "is_active": True,
    "effective_from": datetime.date(2026, 1, 1),
    "effective_to": None,
}

BLOCKS = [
    {
        "block_name": "Lifeline (first 15 units)",
        "min_units": 0,
        "max_units": 15,
        "rate_per_unit": "250.00",
        "block_order": 1,
        "is_lifeline_block": True,
        "non_lifeline_rate": "756.20",
    },
    {
        "block_name": "Normal (16-80 units)",
        "min_units": 16,
        "max_units": 80,
        "rate_per_unit": "756.20",
        "block_order": 2,
        "is_lifeline_block": False,
        "non_lifeline_rate": None,
    },
    {
        "block_name": "Cooking tariff (81-150 units)",
        "min_units": 81,
        "max_units": 150,
        "rate_per_unit": "412.00",
        "block_order": 3,
        "is_lifeline_block": False,
        "non_lifeline_rate": None,
    },
    {
        "block_name": "Super normal (above 150 units)",
        "min_units": 151,
        "max_units": None,
        "rate_per_unit": "756.00",
        "block_order": 4,
        "is_lifeline_block": False,
        "non_lifeline_rate": None,
    },
]


class Command(BaseCommand):
    help = "Seed the ERA/UEDCL domestic tariff (Code 10.1) into the database"

    def handle(self, *args, **options):
        tariff, created = ElectricityTariff.objects.update_or_create(
            tariff_code=DOMESTIC_TARIFF["tariff_code"],
            defaults=DOMESTIC_TARIFF,
        )
        action = "Created" if created else "Updated"
        self.stdout.write(f"{action} tariff: {tariff}")

        for block_data in BLOCKS:
            block, b_created = TariffBlock.objects.update_or_create(
                tariff=tariff,
                block_order=block_data["block_order"],
                defaults=block_data,
            )
            b_action = "Created" if b_created else "Updated"
            self.stdout.write(f"  {b_action} block: {block}")

        # Deactivate legacy flat-rate tariff if present
        ElectricityTariff.objects.filter(tariff_code="CODE10.1").update(is_active=False)

        self.stdout.write(
            self.style.SUCCESS(
                "\nERA domestic tariff seeded successfully.\n"
                "Service charge: UGX 3,360 | VAT: 18% (applied in billing engine)."
            )
        )
