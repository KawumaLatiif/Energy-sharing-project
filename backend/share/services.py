import random
import string
from datetime import timedelta
from django.utils import timezone
from django.db import models
from django.conf import settings
from accounts.tasks import (
    handle_send_share_verification,
    handle_send_transfer_verification,
    handle_send_wallet_update,
)

class VerificationService:
    """
    Service class for handling verification operations
    """
    
    @staticmethod
    def generate_otp_code(length=6):
        """Generate a random OTP code"""
        return ''.join(random.choices(string.digits, k=length))
    
    @staticmethod
    def send_share_verification_email(user, code, transaction_details):
        """
        Send share verification email using Celery task
        """
        try:
            # Call your existing Celery task
            task = handle_send_share_verification.delay(
                user.id,
                code,
                transaction_details
            )
            return task
        except Exception as e:
            print(f"Error queuing share verification email: {e}")
            # Fallback: Send email synchronously if Celery fails
            try:
                # You might want to implement a fallback email sending here
                pass
            except:
                pass
            return None
    
    @staticmethod
    def send_transfer_verification_email(user, code, transaction_details):
        """
        Send transfer verification email using Celery task
        """
        try:
            task = handle_send_transfer_verification.delay(
                user.id,
                code,
                transaction_details
            )
            return task
        except Exception as e:
            print(f"Error queuing transfer verification email: {e}")
            return None
    
    @staticmethod
    def send_wallet_update_email(user, transaction_details):
        """
        Send wallet update email using Celery task
        """
        try:
            task = handle_send_wallet_update.delay(
                user.id,
                transaction_details
            )
            return task
        except Exception as e:
            print(f"Error queuing wallet update email: {e}")
            return None
    
    @staticmethod
    def format_transaction_details(transaction_type, **kwargs):
        """
        Format transaction details for email
        """
        if transaction_type == 'share':
            return f"""
            Sharing Energy Units:
            - From User: {kwargs.get('sender_username', 'N/A')}
            - From Meter: {kwargs.get('sender_meter', 'N/A')}
            - To User: {kwargs.get('receiver_username', 'N/A')}
            - To Meter: {kwargs.get('receiver_meter', 'N/A')}
            - Units: {kwargs.get('units', '0')}
            - Date: {kwargs.get('date', 'N/A')}
            - Transaction ID: {kwargs.get('transaction_id', 'N/A')}
            """
        
        elif transaction_type == 'transfer':
            return f"""
            Transferring Energy Units:
            - From Meter: {kwargs.get('old_meter', 'N/A')}
            - To Meter: {kwargs.get('new_meter', 'N/A')}
            - Units: {kwargs.get('units', '0')}
            - User: {kwargs.get('username', 'N/A')}
            - Date: {kwargs.get('date', 'N/A')}
            - Transaction ID: {kwargs.get('transaction_id', 'N/A')}
            
            WARNING: This will deactivate your old meter!
            """
        
        elif transaction_type == 'wallet_update':
            return f"""
            Wallet Update:
            - Type: {kwargs.get('update_type', 'N/A')}
            - Amount: {kwargs.get('amount', '0')}
            - Description: {kwargs.get('description', 'N/A')}
            - New Balance: {kwargs.get('new_balance', '0')}
            - Transaction ID: {kwargs.get('transaction_id', 'N/A')}
            - Date: {kwargs.get('date', 'N/A')}
            """
        
        return "Transaction details not available."

class VerificationCode(models.Model):
    """
    Model to store verification codes in database
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='verification_codes'
    )
    code = models.CharField(max_length=6)
    purpose = models.CharField(
        max_length=50,
        choices=[
            ('share_units', 'Share Units'),
            ('transfer_units', 'Transfer Units'),
            ('login', 'Login'),
            ('reset_password', 'Reset Password'),
        ]
    )
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'purpose', 'is_used']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['code', 'purpose']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.purpose} - {self.code}"
    
    def is_valid(self):
        """Check if the code is still valid"""
        return not self.is_used and timezone.now() < self.expires_at
    
    def mark_used(self):
        """Mark the code as used"""
        self.is_used = True
        self.save()
    
    @classmethod
    def create_code(cls, user, purpose, expiry_minutes=10):
        """
        Create a new verification code
        """
        # Generate code using VerificationService
        code = VerificationService.generate_otp_code()
        
        # Invalidate any existing codes for this user and purpose
        cls.objects.filter(
            user=user,
            purpose=purpose,
            is_used=False,
            expires_at__gt=timezone.now()
        ).update(is_used=True)
        
        # Calculate expiry time
        expires_at = timezone.now() + timedelta(minutes=expiry_minutes)
        
        # Create new code
        verification_code = cls.objects.create(
            user=user,
            code=code,
            purpose=purpose,
            expires_at=expires_at
        )
        
        return verification_code
    
    @classmethod
    def verify_code(cls, user, code, purpose):
        """
        Verify a code
        """
        try:
            verification = cls.objects.get(
                user=user,
                code=code,
                purpose=purpose,
                is_used=False,
                expires_at__gt=timezone.now()
            )
            verification.mark_used()
            return True
        except cls.DoesNotExist:
            return False
    
    @classmethod
    def get_valid_code(cls, user, purpose):
        """
        Get a valid verification code for a user and purpose
        """
        try:
            return cls.objects.get(
                user=user,
                purpose=purpose,
                is_used=False,
                expires_at__gt=timezone.now()
            )
        except cls.DoesNotExist:
            return None
    
    @classmethod
    def cleanup_expired_codes(cls):
        """
        Clean up expired verification codes
        """
        expired_count = cls.objects.filter(
            expires_at__lte=timezone.now()
        ).delete()[0]
        return expired_count