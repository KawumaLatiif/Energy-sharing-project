import random
import string
import uuid
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone

from accounts.models import User, TimestampMixin


def generate_random_string(length):
    # Define the character set excluding 'i' and '0'
    characters = string.ascii_uppercase.replace('i', '').replace('O', '') + '123456789'

    # Generate the random string
    random_string = ''.join(random.choice(characters) for _ in range(length))
    return random_string


class Meter(TimestampMixin):
    """
    Prepaid electricity meter linked to a user account.
    Enhanced per spec Section 4.
    """
    STATUS_ACTIVE = "ACTIVE"
    STATUS_INACTIVE = "INACTIVE"
    STATUS_SUSPENDED = "SUSPENDED"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_INACTIVE, "Inactive"),
        (STATUS_SUSPENDED, "Suspended"),
    ]

    meter_no = models.CharField(max_length=100, unique=True)
    static_ip = models.GenericIPAddressField(null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    units = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=0.00,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    # Spec additions — Section 4.3
    label = models.CharField(max_length=50, blank=True, default='Home')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    deactivation_reason = models.CharField(max_length=50, null=True, blank=True)
    deactivation_note = models.TextField(null=True, blank=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    deactivated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deactivated_meters'
    )

    def __str__(self):
        return f"{self.meter_no} - {self.label} ({self.status})"

    
class MeterToken(TimestampMixin):
    TOKEN_SOURCE_CHOICES = [
        ('PURCHASE', 'Purchase'),
        ('LOAN', 'Loan'),
        ('SHARE', 'Share'),
        ('TRANSFER', 'Transfer'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=10, unique=True) 
    units = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    meter = models.ForeignKey('Meter', on_delete=models.CASCADE, related_name='tokens')
    is_used = models.BooleanField(default=False)
    source = models.CharField(max_length=10, choices=TOKEN_SOURCE_CHOICES, default='PURCHASE')
    loan_application = models.ForeignKey('loan.LoanApplication', on_delete=models.SET_NULL, null=True, blank=True, related_name='tokens')
    share_transaction_id = models.CharField(max_length=20, null=True, blank=True)
    share_sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='share_tokens_sent'
    )

    def __str__(self):
        return f"Token: {self.token} | Units: {self.units}"


# --------------------------------------------------------------------------- #
#  Transaction model — Section 6.1 (all 9 transaction types)                  #
# --------------------------------------------------------------------------- #
class Transaction(TimestampMixin):
    """
    Unified transaction record for all money/kWh movements in the system.
    Covers all types defined in spec Section 6.1.
    """
    TYPE_PURCHASE = "PURCHASE"
    TYPE_GENERATE_TOKEN = "GENERATE_TOKEN"
    TYPE_TRANSFER_OUT = "TRANSFER_OUT"
    TYPE_TRANSFER_IN = "TRANSFER_IN"
    TYPE_CREDIT = "CREDIT"
    TYPE_REPAYMENT_AUTO = "REPAYMENT_AUTO"
    TYPE_REPAYMENT_DIRECT = "REPAYMENT_DIRECT"
    TYPE_PENALTY = "PENALTY"
    TYPE_REFUND = "REFUND"

    TRANSACTION_TYPES = [
        (TYPE_PURCHASE, "Purchase"),
        (TYPE_GENERATE_TOKEN, "Generate Token"),
        (TYPE_TRANSFER_OUT, "Transfer Out"),
        (TYPE_TRANSFER_IN, "Transfer In"),
        (TYPE_CREDIT, "Credit"),
        (TYPE_REPAYMENT_AUTO, "Repayment (Auto)"),
        (TYPE_REPAYMENT_DIRECT, "Repayment (Direct)"),
        (TYPE_PENALTY, "Penalty"),
        (TYPE_REFUND, "Refund"),
    ]

    STATUS_COMPLETED = "COMPLETED"
    STATUS_FAILED = "FAILED"
    STATUS_PENDING = "PENDING"
    STATUS_REVERSED = "REVERSED"

    STATUS_CHOICES = [
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_PENDING, "Pending"),
        (STATUS_REVERSED, "Reversed"),
    ]

    CHANNEL_USSD = "USSD"
    CHANNEL_APP = "MOBILE_APP"
    CHANNEL_WEB = "WEB_PORTAL"
    CHANNEL_ADMIN = "ADMIN"

    CHANNEL_CHOICES = [
        (CHANNEL_USSD, "USSD"),
        (CHANNEL_APP, "Mobile App"),
        (CHANNEL_WEB, "Web Portal"),
        (CHANNEL_ADMIN, "Admin"),
    ]

    transaction_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    amount_kwh = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    amount_ugx = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    source = models.CharField(max_length=100, blank=True, default='')  # wallet, purchase, credit
    destination = models.CharField(max_length=100, blank=True, default='')  # meter number, wallet, loan
    meter = models.ForeignKey(Meter, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    sts_token = models.CharField(max_length=30, blank=True, default='')  # 20-digit STS token if applicable
    payment_reference = models.CharField(max_length=100, blank=True, default='')  # Mobile Money ref
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    channel = models.CharField(max_length=12, choices=CHANNEL_CHOICES, default=CHANNEL_USSD)
    failure_reason = models.CharField(max_length=200, blank=True, default='')
    # Link to related loan if applicable
    loan = models.ForeignKey(
        'loan.LoanApplication', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='transactions'
    )
    # Fraud flag
    is_flagged = models.BooleanField(default=False)
    flag_reason = models.CharField(max_length=200, blank=True, default='')
    # Admin refund tracking
    refunded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='refunds_issued'
    )
    refund_reason = models.TextField(blank=True, default='')
    refunded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-create_date']
        indexes = [
            models.Index(fields=['user', 'create_date']),
            models.Index(fields=['transaction_type', 'status']),
            models.Index(fields=['meter', 'create_date']),
            models.Index(fields=['is_flagged']),
        ]

    def __str__(self):
        return f"{self.transaction_type} — {self.user.email} — {self.amount_kwh} kWh ({self.status})"

