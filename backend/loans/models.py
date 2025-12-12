from django.db import models
import random
import string
from accounts.models import User,TimestampMixin


def generate_random_string(length):
    # Define the character set excluding 'i' and '0'
    characters = string.ascii_uppercase.replace('i', '').replace('O', '') + '123456789'

    # Generate the random string
    random_string = ''.join(random.choice(characters) for _ in range(length))
    return random_string


class Meter(TimestampMixin):
    """
    Model for ESP32 Device to store static IP and other device-related information
    """
    meter_no = models.CharField(max_length=100, unique=True)  
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='devices')
    units = models.PositiveIntegerField(default=0)


    def __str__(self):
        return f"{self.meter_no}"

    
class MeterToken(TimestampMixin):
    TOKEN_SOURCE_CHOICES = [
        ('PURCHASE', 'Purchase'),
        ('LOAN', 'Loan'),
        ('TRANSFER', 'Transfer'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=10, unique=True) 
    units = models.FloatField()
    meter = models.ForeignKey('Meter', on_delete=models.CASCADE, related_name='tokens')
    is_used = models.BooleanField(default=False)
    source = models.CharField(max_length=10, choices=TOKEN_SOURCE_CHOICES, default='PURCHASE')
    loan_application = models.ForeignKey('loan.LoanApplication', on_delete=models.SET_NULL, null=True, blank=True, related_name='tokens')

    def __str__(self):
        return f"Token: {self.token} | Units: {self.units}"

