import random
import string
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal

from accounts.models import User, TimestampMixin


def generate_numeric_token(length=10):
    """
    Generate a token with ONLY numbers (digits 0-9)
    """
    return ''.join(random.choices(string.digits, k=length))


def generate_random_string(length):
    # Keep original for backward compatibility
    characters = string.ascii_uppercase.replace('i', '').replace('O', '') + '123456789'
    random_string = ''.join(random.choice(characters) for _ in range(length))
    return random_string


class Meter(TimestampMixin):
    """
    Model for ESP32 Device to store static IP and other device-related information
    """
    meter_no = models.CharField(max_length=100, unique=True)
    static_ip = models.GenericIPAddressField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    units = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        default=0.00,
        validators=[MinValueValidator(Decimal('0.00'))]
    )

    def __str__(self):
        return f"{self.meter_no} - IP: {self.static_ip}"


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

    def save(self, *args, **kwargs):
        # Ensure token only contains numbers if not already set
        if not self.token:
            self.token = generate_numeric_token(10)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Token: {self.token} | Units: {self.units}"