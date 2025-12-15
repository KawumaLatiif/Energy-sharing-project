from django.db import models
from accounts.models import User
import random
import string
from django.utils import timezone
from datetime import timedelta
from django.core.exceptions import ValidationError
from dateutil.relativedelta import relativedelta

# Add tier configuration
LOAN_TIERS = [
    {
        'name': 'Bronze',
        'min_score': 75,
        'max_score': 79,
        'max_amount': 50000,
        'interest_rate': 12.0
    },
    {
        'name': 'Silver',
        'min_score': 80,
        'max_score': 84,
        'max_amount': 100000,
        'interest_rate': 11.0
    },
    {
        'name': 'Gold',
        'min_score': 85,
        'max_score': 89,
        'max_amount': 150000,
        'interest_rate': 10.0
    },
    {
        'name': 'Platinum',
        'min_score': 90,
        'max_score': 100,
        'max_amount': 200000,
        'interest_rate': 9.0
    }
]

def get_tier_by_score(score):
    """Get loan tier based on credit score"""
    for tier in LOAN_TIERS:
        if tier['min_score'] <= score <= tier['max_score']:
            return tier
    return None    

def generate_loan_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))


def generate_token():
    return ''.join(random.choices(string.digits, k=10))  

class ElectricityTariff(models.Model):
    TARIFF_TYPES = (
        ('DOMESTIC', 'Domestic'),
        ('COMMERCIAL', 'Commercial'),
        ('INDUSTRIAL', 'Industrial'),
    )
    
    tariff_code = models.CharField(max_length=20, unique=True)
    tariff_name = models.CharField(max_length=100)
    tariff_type = models.CharField(max_length=20, choices=TARIFF_TYPES, default='DOMESTIC')
    voltage_level = models.CharField(max_length=50)
    voltage_value = models.CharField(max_length=20, blank=True)
    service_charge = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    effective_date = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"{self.tariff_code} - {self.tariff_name}"

class TariffBlock(models.Model):
    tariff = models.ForeignKey(ElectricityTariff, on_delete=models.CASCADE, related_name='blocks')
    block_name = models.CharField(max_length=100) 
    min_units = models.IntegerField(default=0)  
    max_units = models.IntegerField(null=True, blank=True)  
    rate_per_unit = models.DecimalField(max_digits=8, decimal_places=2)  
    block_order = models.IntegerField(default=0)  
    
    class Meta:
        ordering = ['block_order']
    
    def __str__(self):
        if self.max_units:
            return f"{self.block_name} ({self.min_units}-{self.max_units} kWh): {self.rate_per_unit} UGX"
        else:
            return f"{self.block_name} (Above {self.min_units} kWh): {self.rate_per_unit} UGX"

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class LoanApplication(TimeStampedModel):
    LOAN_STATUS = (
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('DISBURSED', 'Disbursed'),
        ('COMPLETED', 'Completed'),
        ('DEFAULTED', 'Defaulted'),
    )
    LOAN_TIER_CHOICES = (
        ('BRONZE', 'Bronze'),
        ('SILVER', 'Silver'),
        ('GOLD', 'Gold'),
        ('PLATINUM', 'Platinum'),
    )    
    loan_id = models.CharField(max_length=10, unique=True, default=generate_loan_id)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='loan_applications')
    purpose = models.TextField()
    amount_requested = models.DecimalField(max_digits=10, decimal_places=2)
    amount_approved = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    tenure_months = models.IntegerField(default=6)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=10.0)
    status = models.CharField(max_length=20, choices=LOAN_STATUS, default='PENDING')
    credit_score = models.IntegerField(null=True, blank=True)
    loan_tier = models.CharField(max_length=20, choices=LOAN_TIER_CHOICES, null=True, blank=True)
    tariff = models.ForeignKey(ElectricityTariff, on_delete=models.SET_NULL, null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    user_notified = models.BooleanField(default=False)
    
    def check_eligibility(self):
        return self.credit_score >= 75 if self.credit_score else False
    
    def save(self, *args, **kwargs):
        if self.credit_score:
            tier_info = get_tier_by_score(self.credit_score)
            if tier_info:
                tier_name = tier_info['name']
                interest_rate = tier_info['interest_rate']
                self.loan_tier = tier_name
                self.interest_rate = interest_rate
        
        # Auto-set status based on eligibility if not already set
        if not self.pk and not self.status:  # Only for new instances
            if self.check_eligibility():
                self.status = 'APPROVED'
            else:
                self.status = 'REJECTED'
                self.rejection_reason = "Credit score below 75% threshold"
        
        super().save(*args, **kwargs)

    def get_max_eligible_amount(self):
        """Get maximum loan amount user is eligible for based on tier"""
        if self.credit_score and self.loan_tier:
            tier = get_tier_by_score(self.credit_score)
            return tier['max_amount'] if tier else 0
        return 0
    
    def calculate_units_from_amount(self, amount=None):
        """Calculate how many kWh units a given amount can purchase based on tariff block rates"""
        loan_amount = float(amount or self.amount_approved)
        
        if not self.tariff:
            return loan_amount / 500
        
        # Get tariff blocks in order
        blocks = self.tariff.blocks.all().order_by('block_order')
        
        if not blocks.exists():
            return loan_amount / 500
        
        remaining_amount = loan_amount
        total_units = 0
        
        for block in blocks:
            if remaining_amount <= 0:
                break
                
            # Calculate how many units are available in this block
            if block.max_units:
                block_units_available = block.max_units - block.min_units + 1
            else:
                # Last block (unlimited)
                block_units_available = float('inf')
            
            # Calculate how much money is needed for this block
            if block_units_available == float('inf'):
                # Last block - use all remaining money
                units_from_block = remaining_amount / float(block.rate_per_unit)
                total_units += units_from_block
                break
            else:
                block_cost = block_units_available * float(block.rate_per_unit)
                
                if remaining_amount >= block_cost:
                    # Can afford entire block
                    total_units += block_units_available
                    remaining_amount -= block_cost
                else:
                    # Can afford partial block
                    units_from_block = remaining_amount / float(block.rate_per_unit)
                    total_units += units_from_block
                    remaining_amount = 0
                    break
        
        return round(total_units)
    
    def calculate_cost_for_units(self, units):
        """Calculate the cost for a specific number of units based on tariff blocks"""
        if not self.tariff:
            return units * 500 
        
        blocks = self.tariff.blocks.all().order_by('block_order')
        remaining_units = units
        total_cost = 0
        
        for block in blocks:
            if remaining_units <= 0:
                break
                
            if block.max_units:
                block_units_available = block.max_units - block.min_units + 1
                units_in_block = min(remaining_units, block_units_available)
            else:
                # Last block (unlimited)
                units_in_block = remaining_units
            
            total_cost += units_in_block * float(block.rate_per_unit)
            remaining_units -= units_in_block
        
        return total_cost

    def __str__(self):
        tier_display = f" ({self.loan_tier})" if self.loan_tier else ""
        return f"Loan #{self.loan_id}{tier_display} - {self.user.email} - {self.status}"
    
    @property
    def due_date(self):
        if hasattr(self, 'disbursement') and self.disbursement:
            return self.disbursement.disbursement_date + relativedelta(months=self.tenure_months)
        return None
    
    @property
    def total_amount_due(self):
        if not self.amount_approved:
            return 0
        interest = (float(self.amount_approved) * float(self.interest_rate) / 100) * (self.tenure_months / 12)
        return float(self.amount_approved) + interest
    
    @property
    def amount_paid(self):
        return sum(float(repayment.amount_paid) for repayment in self.repayments.all())
    
    @property
    def outstanding_balance(self):
        total_due = self.total_amount_due
        if self.due_date and timezone.now() > self.due_date:
            days_late = (timezone.now() - self.due_date).days
            penalty_rate = 0.001  # 0.1% per day penalty (adjust as needed)
            penalty = days_late * penalty_rate * float(self.amount_approved)
            total_due += penalty
        return total_due - self.amount_paid
    
    class Meta:
        ordering = ['-created_at']


class LoanDisbursement(TimeStampedModel):
    loan_application = models.OneToOneField(LoanApplication, on_delete=models.CASCADE, related_name='disbursement')
    disbursement_date = models.DateTimeField(auto_now_add=True)
    disbursed_amount = models.DecimalField(max_digits=10, decimal_places=2)
    units_disbursed = models.FloatField()
    token = models.CharField(max_length=10, unique=True, default=generate_token)
    token_expiry = models.DateTimeField()
    meter = models.ForeignKey('meter.Meter', on_delete=models.CASCADE, related_name='loan_disbursements')
    
    def __str__(self):
        return f"Disbursement for Loan #{self.loan_application.loan_id} - Token: {self.token}"
    
    def save(self, *args, **kwargs):
        if not self.token_expiry:
            self.token_expiry = timezone.now() + timedelta(days=30)
        super().save(*args, **kwargs)


class LoanRepayment(TimeStampedModel):
    loan = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='repayments')
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateTimeField(auto_now_add=True)
    units_paid = models.FloatField()
    is_on_time = models.BooleanField(default=True)
    payment_reference = models.CharField(max_length=50, unique=True)
    
    
    payment_method = models.CharField(
        max_length=20, 
        choices=[
            ('CASH', 'Cash'),
            ('MOBILE_MONEY', 'Mobile Money'),
            ('BANK_TRANSFER', 'Bank Transfer')
        ],
        default='CASH'
    )
    momo_transaction_id = models.CharField(max_length=100, blank=True, null=True)
    momo_external_id = models.CharField(max_length=100, blank=True, null=True)
    momo_phone_number = models.CharField(max_length=15, blank=True, null=True)
    payment_status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('SUCCESS', 'Success'),
            ('FAILED', 'Failed'),
            ('CANCELLED', 'Cancelled')
        ],
        default='PENDING'
    )
    
    def __str__(self):
        return f"Repayment #{self.id} for Loan #{self.loan.loan_id}"
    
    class Meta:
        ordering = ['-created_at']