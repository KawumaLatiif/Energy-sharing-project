from decimal import Decimal
from django.db import IntegrityError
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Wallet, MeterBalance
import logging

logger = logging.getLogger(__name__)

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_wallet(sender, instance, created, **kwargs):
    if created:
        Wallet.objects.get_or_create(user=instance)
        logger.info("Unit wallet created for user %s", instance.username)


@receiver(post_save, sender="meter.Meter")
def sync_meter_balance(sender, instance, created, **kwargs):
    """Sync MeterBalance when a meter is created or updated (including renames)."""
    if not instance.user_id:
        return
    try:
        MeterBalance.objects.update_or_create(
            meter=instance,
            defaults={
                "user": instance.user,
                "meter_number": instance.meter_no,
                "balance": Decimal(str(instance.units or 0)),
                "is_active": True,
            },
        )
    except IntegrityError:
        logger.warning(
            "MeterBalance OneToOne conflict for meter %s; retrying by meter_number",
            instance.meter_no,
            exc_info=True,
        )
        try:
            MeterBalance.objects.update_or_create(
                meter_number=instance.meter_no,
                defaults={
                    "user": instance.user,
                    "meter": instance,
                    "balance": Decimal(str(instance.units or 0)),
                    "is_active": True,
                },
            )
        except Exception:
            logger.exception("MeterBalance sync failed for meter %s", instance.meter_no)
