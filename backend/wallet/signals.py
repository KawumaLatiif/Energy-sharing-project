from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Wallet, MeterBalance

User = get_user_model()

@receiver(post_save, sender=User)
def create_user_wallet(sender, instance, created, **kwargs):
    """Create wallet when a new user is created"""
    if created:
        Wallet.objects.create(user=instance)
        logger.info(f"Wallet created for user {instance.username}")

@receiver(post_save, sender='meter.Meter')  # Adjust to your actual meter model
def create_meter_balance(sender, instance, created, **kwargs):
    """Create meter balance record when a meter is created"""
    if created and instance.user:
        MeterBalance.objects.create(
            user=instance.user,
            meter_number=instance.meter_number,
            balance=Decimal('0.00'),
            is_active=instance.is_active
        )