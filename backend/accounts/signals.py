import logging
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from accounts.models import Profile, User, UserAccountDetails, Wallet
from accounts.tasks import handle_send_email_verification
from utils.general import generate_numeric_id
from django.apps import AppConfig

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Profile)
def send_email_verification(sender, instance, created, **kwargs):
    if created and not instance.email_verified:
        user_id = instance.user.pk
        # trigger rabbitmq to send a verification email notification
        handle_send_email_verification.delay(user_id)


@receiver(post_save, sender=User)
def create_user_account_details(sender, instance, created, **kwargs):
    if created:
        UserAccountDetails.objects.create(user=instance)



class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        import accounts.signals
