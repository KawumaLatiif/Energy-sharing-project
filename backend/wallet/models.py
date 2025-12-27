from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from decimal import Decimal
import uuid

User = get_user_model()

# Create a function to generate transaction reference
def generate_transaction_ref():
    return f"TX-{uuid.uuid4().hex[:8].upper()}"

# Create a function to generate meter transaction reference
def generate_meter_transaction_ref():
    return f"MTR-{uuid.uuid4().hex[:8].upper()}"

# Create a function to generate share transaction ID
def generate_share_transaction_id():
    return f"SHARE-{uuid.uuid4().hex[:8].upper()}"

class Wallet(models.Model):
    """
    Main wallet for each user
    """
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='mainwallet'
    )
    balance = models.DecimalField(
        max_digits=20, 
        decimal_places=2, 
        default=0.00,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username}'s Wallet: {self.balance} units"
    
    def has_sufficient_balance(self, amount):
        """Check if wallet has sufficient balance"""
        return self.balance >= Decimal(str(amount))
    
    def deduct(self, amount, description="", transaction_ref=""):
        """Deduct amount from wallet and create transaction record"""
        if not self.has_sufficient_balance(amount):
            raise ValueError("Insufficient balance")
        
        self.balance -= Decimal(str(amount))
        self.save()
        
        # Create transaction record
        Transaction.objects.create(
            wallet=self,
            amount=Decimal(str(amount)),
            transaction_type='DEBIT',
            balance_after=self.balance,
            description=description,
            reference=transaction_ref or generate_transaction_ref(),
        )
        
        return self.balance
    
    def add(self, amount, description="", transaction_ref=""):
        """Add amount to wallet and create transaction record"""
        self.balance += Decimal(str(amount))
        self.save()
        
        # Create transaction record
        Transaction.objects.create(
            wallet=self,
            amount=Decimal(str(amount)),
            transaction_type='CREDIT',
            balance_after=self.balance,
            description=description,
            reference=transaction_ref or generate_transaction_ref(),
        )
        
        return self.balance

class Transaction(models.Model):
    """
    Transaction history for wallet
    """
    TRANSACTION_TYPES = [
        ('CREDIT', 'Credit'),
        ('DEBIT', 'Debit'),
        ('SHARE', 'Share'),
        ('TRANSFER', 'Transfer'),
        ('PURCHASE', 'Purchase'),
    ]
    
    wallet = models.ForeignKey(
        Wallet, 
        on_delete=models.CASCADE, 
        related_name='transactions'
    )
    amount = models.DecimalField(
        max_digits=20, 
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    transaction_type = models.CharField(
        max_length=20, 
        choices=TRANSACTION_TYPES
    )
    balance_after = models.DecimalField(
        max_digits=20, 
        decimal_places=2
    )
    description = models.TextField(null=True, blank=True)
    reference = models.CharField(
        max_length=100, 
        unique=True,
        default=generate_transaction_ref
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['reference']),
            models.Index(fields=['wallet', 'created_at']),
            models.Index(fields=['transaction_type', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.transaction_type} - {self.amount} - Ref: {self.reference}"

class MeterBalance(models.Model):
    """
    Tracks balance for each meter
    """
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='meter_balances'
    )
    meter_number = models.CharField(max_length=20, unique=True)
    balance = models.DecimalField(
        max_digits=20, 
        decimal_places=2, 
        default=0.00,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Meter {self.meter_number}: {self.balance} units"
    
    def update_balance(self, amount, operation='add', description=""):
        """Update meter balance"""
        if operation == 'add':
            self.balance += Decimal(str(amount))
        elif operation == 'deduct':
            if self.balance < Decimal(str(amount)):
                raise ValueError("Insufficient meter balance")
            self.balance -= Decimal(str(amount))
        
        self.save()
        
        # Create meter transaction record
        MeterTransaction.objects.create(
            meter=self,
            amount=Decimal(str(amount)),
            operation=operation.upper(),
            balance_after=self.balance,
            description=description,
        )
        
        return self.balance

class MeterTransaction(models.Model):
    """
    Transaction history for each meter
    """
    OPERATION_TYPES = [
        ('ADD', 'Add'),
        ('DEDUCT', 'Deduct'),
        ('SHARE_IN', 'Share In'),
        ('SHARE_OUT', 'Share Out'),
        ('TRANSFER', 'Transfer'),
    ]
    
    meter = models.ForeignKey(
        MeterBalance, 
        on_delete=models.CASCADE, 
        related_name='transactions'
    )
    amount = models.DecimalField(
        max_digits=20, 
        decimal_places=2
    )
    operation = models.CharField(
        max_length=20, 
        choices=OPERATION_TYPES
    )
    balance_after = models.DecimalField(
        max_digits=20, 
        decimal_places=2
    )
    description = models.TextField(null=True, blank=True)
    reference = models.CharField(
        max_length=100, 
        default=generate_meter_transaction_ref
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.operation} - {self.amount} - Meter: {self.meter.meter_number}"