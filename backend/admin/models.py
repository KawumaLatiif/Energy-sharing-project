from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class AdminNotificationSettings(models.Model):
    """Notification settings for admin users"""
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE,
        related_name='notification_settings'
    )
    
    # Notification channels
    email_notifications = models.BooleanField(default=True)
    sms_notifications = models.BooleanField(default=False)
    
    # Notification types
    loan_approvals = models.BooleanField(default=True)
    user_registrations = models.BooleanField(default=True)
    system_alerts = models.BooleanField(default=True)
    weekly_reports = models.BooleanField(default=False)
    
    # Schedule preferences
    report_schedule = models.CharField(
        max_length=20,
        choices=[
            ('weekly', 'Weekly'),
            ('daily', 'Daily'),
            ('monthly', 'Monthly'),
            ('never', 'Never')
        ],
        default='weekly'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Notification settings for {self.user.email}"
    
    class Meta:
        app_label = 'admin'  # Add this line
        verbose_name = "Admin Notification Settings"
        verbose_name_plural = "Admin Notification Settings"


class AdminSession(models.Model):
    """Track admin sessions"""
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    session_key = models.CharField(max_length=40)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    is_active = models.BooleanField(default=True)
    login_time = models.DateTimeField(auto_now_add=True)
    logout_time = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    
    class Meta:
        app_label = 'admin'  # Add this line
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['expires_at']),
        ]
        ordering = ['-login_time']
    
    def __str__(self):
        return f"Session {self.session_key} for {self.user.email}"


class AdminActivityLog(models.Model):
    """Log admin activities"""
    user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL,
        null=True,
        related_name='activities'
    )
    action = models.CharField(max_length=100)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        app_label = 'admin' 
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.action} by {self.user.email if self.user else 'Unknown'}"