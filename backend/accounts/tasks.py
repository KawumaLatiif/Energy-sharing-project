from celery.utils.log import get_task_logger
from django.conf import settings
from celery import shared_task
from django.utils.encoding import force_str as force_text
from accounts.constants import ACCOUNT_VERIFICATION_SUBJECT, SECURITY_CODE
from accounts.utils import (
    b64encode_user,
    get_should_resend,
)
from accounts.models import User
from backend import celery_app as app
from utils.auth import token_generator
from utils.email import send_email
from utils.general import get_base_url
import random
import string



logger = get_task_logger(__name__)


@app.task()
def handle_send_email_verification(user_id):
    """
    Task that sends an email verification notification to a user
    """
    logger.info(f"[EMAIL VERIFICATION] Starting email verification for user {user_id}")
    
    try:
        user = User.objects.filter(pk=user_id).first()
        if not user:
            logger.error(f"[EMAIL VERIFICATION] User with ID {user_id} not found")
            return False
            
        logger.info(f"[EMAIL VERIFICATION] Found user: {user.email}")
        
        token = token_generator.make_token(user)
        user_hash = b64encode_user(force_text(user_id))
        
        # Use query parameters instead of path parameters to avoid encoding issues
        url = f"{get_base_url()}/auth/verify-email?uid={user_hash}&token={token}"
        
        logger.info(f"[EMAIL VERIFICATION] Generated verification URL: {url}")
        
        message = (
            "You're almost there. Please click the link below to verify "
            f"your account\n\n{url}"
        )

        logger.info(
            f"[EMAIL VERIFICATION] About to send email to {user.email}"
        )
        
        sent, message = send_email(
            sender=settings.DEFAULT_EMAIL_SENDER,
            recipients=[user.email],
            subject=ACCOUNT_VERIFICATION_SUBJECT,
            message=message,
            reply_to=[settings.DEFAULT_EMAIL_SENDER],
        )
        
        if sent:
            logger.info(
                f"[EMAIL VERIFICATION] Email sent successfully to {user.email}"
            )
            return True
        else:
            logger.error(
                f"[EMAIL VERIFICATION] Failed to send email to {user.email}: {message}"
            )
            return False
            
    except Exception as e:
        logger.exception(f"[EMAIL VERIFICATION] Error in handle_send_email_verification: {str(e)}")
        return False


@app.task()
def handle_send_email_code(user_id, code):
    """
    Task that sends an email verification for settings change
    """
    logger.info("about to send settings change email")
    user = User.objects.filter(pk=user_id).first()

    message = (
        f"Security code: {code}"
    )

    logger.info(
        "[ACCOUNTS] About to send security code email "
        f"email to user {user_id}"
    )
    sent, message = send_email(
        sender=settings.DEFAULT_EMAIL_SENDER,
        recipients=[user.email],
        subject=SECURITY_CODE,
        message=message,
        reply_to=[settings.DEFAULT_EMAIL_SENDER],
    )
    if sent:
        logger.info(
            f"[ACCOUNTS] Security code. Sent: {sent}, message: {message},"
            f" user: {user_id}"
        )
    else:
        logger.info(
            f"[ACCOUNTS] Security code.  Not sent. message: {message}"
        )


# sample tasks
@app.task(name="add_task")
def add_task():
    logger.info("begin add task")
    logger.info("name--:")
    logger.info("done add task")


@app.task(bind=True)
def sum(self, x, y):
    logger.info("adding")
    sum = x + y
    logger.info(f"sum: {sum}")
    return sum


# Using a custom retry delay
@app.task(bind=True)
def retry(self):
    try:
        logger.info("executing")
        return 1 / 0
    except Exception as exc:
        logger.exception(f"error: {str(exc)}")
        raise self.retry(exc=exc, countdown=5, max_retries=3)


@app.task()
def handle_send_share_verification(user_id, code, transaction_details):
    """
    Task that sends a share verification email with OTP
    """
    logger.info(f"[SHARE VERIFICATION] Sending share verification for user {user_id}")
    
    try:
        user = User.objects.filter(pk=user_id).first()
        if not user:
            logger.error(f"[SHARE VERIFICATION] User with ID {user_id} not found")
            return False
            
        logger.info(f"[SHARE VERIFICATION] Found user: {user.email}")
        
        subject = "Verify Your Energy Units Sharing"
        
        message = f"""
        Hi {user.username},
        
        You are about to share energy units. Please use the verification code below:
        
        Verification Code: {code}
        
        Transaction Details:
        {transaction_details}
        
        This code will expire in 10 minutes.
        
        If you didn't initiate this transaction, please contact support immediately.
        
        Best regards,
        Energy Sharing Team
        """
        
        logger.info(f"[SHARE VERIFICATION] About to send email to {user.email}")
        
        sent, email_message = send_email(
            sender=settings.DEFAULT_EMAIL_SENDER,
            recipients=[user.email],
            subject=subject,
            message=message,
            reply_to=[settings.DEFAULT_EMAIL_SENDER],
        )
        
        if sent:
            logger.info(f"[SHARE VERIFICATION] Email sent successfully to {user.email}")
            return True
        else:
            logger.error(f"[SHARE VERIFICATION] Failed to send email to {user.email}: {email_message}")
            return False
            
    except Exception as e:
        logger.exception(f"[SHARE VERIFICATION] Error in handle_send_share_verification: {str(e)}")
        return False

@app.task()
def handle_send_transfer_verification(user_id, code, transaction_details):
    """
    Task that sends a transfer verification email with OTP
    """
    logger.info(f"[TRANSFER VERIFICATION] Sending transfer verification for user {user_id}")
    
    try:
        user = User.objects.filter(pk=user_id).first()
        if not user:
            logger.error(f"[TRANSFER VERIFICATION] User with ID {user_id} not found")
            return False
            
        logger.info(f"[TRANSFER VERIFICATION] Found user: {user.email}")
        
        subject = "Verify Your Meter Transfer"
        
        message = f"""
        Hi {user.username},
        
        You are about to transfer all units to a new meter. Please use the verification code below:
        
        Verification Code: {code}
        
        Transaction Details:
        {transaction_details}
        
        WARNING: This will deactivate your old meter!
        
        This code will expire in 10 minutes.
        
        If you didn't initiate this transfer, please contact support immediately.
        
        Best regards,
        Energy Sharing Team
        """
        
        logger.info(f"[TRANSFER VERIFICATION] About to send email to {user.email}")
        
        sent, email_message = send_email(
            sender=settings.DEFAULT_EMAIL_SENDER,
            recipients=[user.email],
            subject=subject,
            message=message,
            reply_to=[settings.DEFAULT_EMAIL_SENDER],
        )
        
        if sent:
            logger.info(f"[TRANSFER VERIFICATION] Email sent successfully to {user.email}")
            return True
        else:
            logger.error(f"[TRANSFER VERIFICATION] Failed to send email to {user.email}: {email_message}")
            return False
            
    except Exception as e:
        logger.exception(f"[TRANSFER VERIFICATION] Error in handle_send_transfer_verification: {str(e)}")
        return False

@app.task()
def handle_send_wallet_update(user_id, transaction_details):
    """
    Task that sends wallet update notification
    """
    logger.info(f"[WALLET UPDATE] Sending wallet update for user {user_id}")
    
    try:
        user = User.objects.filter(pk=user_id).first()
        if not user:
            logger.error(f"[WALLET UPDATE] User with ID {user_id} not found")
            return False
            
        subject = "Wallet Transaction Update"
        
        message = f"""
        Hi {user.username},
        
        Your wallet has been updated:
        
        {transaction_details}
        
        If you didn't authorize this transaction, please contact support immediately.
        
        Best regards,
        Energy Sharing Team
        """
        
        sent, email_message = send_email(
            sender=settings.DEFAULT_EMAIL_SENDER,
            recipients=[user.email],
            subject=subject,
            message=message,
            reply_to=[settings.DEFAULT_EMAIL_SENDER],
        )
        
        if sent:
            logger.info(f"[WALLET UPDATE] Email sent successfully to {user.email}")
            return True
        else:
            logger.error(f"[WALLET UPDATE] Failed to send email to {user.email}: {email_message}")
            return False
            
    except Exception as e:
        logger.exception(f"[WALLET UPDATE] Error in handle_send_wallet_update: {str(e)}")
        return False