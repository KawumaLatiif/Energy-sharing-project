from django.db.models.signals import post_save
from django.dispatch import receiver
from decimal import Decimal
from django.db import transaction
from .models import Meter
from wallet.models import Wallet, MeterBalance
from accounts.models import User

@receiver(post_save, sender=Meter)
def sync_meter_to_balance(sender, instance, **kwargs):
    if instance.pk:  # Skip on create if no units yet
        with transaction.atomic():
            user = instance.user
            wallet = Wallet.objects.select_for_update().get(user=user)
            
            # Update/create MeterBalance
            meter_balance, _ = MeterBalance.objects.get_or_create(
                user=user,
                meter_number=instance.meter_no,
                defaults={'balance': Decimal(str(instance.units)), 'is_active': True}
            )
            if meter_balance.balance != Decimal(str(instance.units)):
                meter_balance.balance = Decimal(str(instance.units))
                meter_balance.save()
            
            # Update wallet total (re-sum if needed; optimize with signal on units change)
            total = sum(mb.balance for mb in MeterBalance.objects.filter(user=user))
            if wallet.balance != total:
                wallet.balance = total
                wallet.save()