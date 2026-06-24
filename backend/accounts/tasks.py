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
        frontend_url = settings.FRONTEND_URL.rstrip('/')
        url = f"{frontend_url}/auth/verify-email?uid={user_hash}&token={token}"
        
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
        transaction_details_html = str(transaction_details).replace("\n", "<br/>")

        # Simple, clear HTML layout to highlight the OTP
        message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
            <div style="border: 1px solid #e6e6e6; border-radius: 10px; padding: 24px;">
                <h2 style="margin: 0 0 12px 0; color: #0f172a;">Share Verification</h2>
                <p style="margin: 0 0 16px 0;">Hi {user.first_name or user.email},</p>
                <p style="margin: 0 0 12px 0;">You're about to share energy units. Use the code below to confirm:</p>

                <div style="background:#0f172a; color:#ffffff; text-align:center; padding:14px 18px; border-radius: 8px; letter-spacing: 6px; font-size: 28px; font-weight: 700; margin: 12px 0;">
                    {code}
                </div>

                <p style="margin: 0 0 10px 0; font-weight: 600;">Transaction Details</p>
                <div style="background:#f8fafc; padding:12px 14px; border-radius:8px; font-size:14px; line-height:1.5; border:1px solid #e2e8f0;">
                    {transaction_details_html}
                </div>

                <p style="margin: 14px 0 6px 0;">This code expires in <strong>10 minutes</strong>.</p>
                <p style="margin: 0 0 14px 0; color:#dc2626;">If you didn't initiate this transaction, contact support immediately.</p>

                <p style="margin: 0;">Best regards,<br/>gPawa Team</p>
            </div>
            <p style="font-size:12px; color:#6b7280; margin-top:12px;">Do not share this code with anyone.</p>
        </div>
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
        Hi {user.first_name},
        
        You are about to transfer all units to a new meter. Please use the verification code below:
        
        Verification Code: {code}
        
        Transaction Details:
        {transaction_details}
        
        WARNING: This will deactivate your old meter!
        
        This code will expire in 10 minutes.
        
        If you didn't initiate this transfer, please contact support immediately.
        
        Best regards,
        gPawa Team
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
        transaction_details_html = str(transaction_details).replace("\n", "<br/>")
        
        message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
            <div style="border: 1px solid #e6e6e6; border-radius: 10px; padding: 24px;">
                <h2 style="margin: 0 0 12px 0; color: #0f172a;">Wallet Update</h2>
                <p style="margin: 0 0 12px 0;">Hi {user.first_name or user.email},</p>
                <p style="margin: 0 0 10px 0;">Your wallet was updated. Here are the details:</p>

                <div style="background:#f8fafc; padding:12px 14px; border-radius:8px; font-size:14px; line-height:1.5; border:1px solid #e2e8f0;">
                    {transaction_details_html}
                </div>

                <p style="margin: 14px 0 6px 0; color:#dc2626;">If you didn't authorize this transaction, contact support immediately.</p>
                <p style="margin: 0;">Best regards,<br/>gPawa Team</p>
            </div>
            <p style="font-size:12px; color:#6b7280; margin-top:12px;">Do not share sensitive information from this email.</p>
        </div>
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


@app.task()
def handle_send_share_token(user_id, token, units, meter_number, sender_meter=None, sender_email=None):
    """
    Task that sends a share token to the receiver's email
    """
    logger.info(f"[SHARE TOKEN] Sending share token to user {user_id}")
    
    try:
        user = User.objects.filter(pk=user_id).first()
        if not user:
            logger.error(f"[SHARE TOKEN] User with ID {user_id} not found")
            return False
            
        subject = "Your Shared Energy Units Token"
        
        sender_line = ""
        if sender_email or sender_meter:
            sender_parts = []
            if sender_email:
                sender_parts.append(sender_email)
            if sender_meter:
                sender_parts.append(f"Meter {sender_meter}")
            sender_line = f"Shared by: {', '.join(sender_parts)}"

        message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
            <div style="border: 1px solid #e6e6e6; border-radius: 10px; padding: 24px;">
                <h2 style="margin: 0 0 12px 0; color: #0f172a;">Shared Units Token</h2>
                <p style="margin: 0 0 12px 0;">Hi {user.first_name or user.email},</p>
                <p style="margin: 0 0 10px 0;">You have received <strong>{units}</strong> energy units for meter <strong>{meter_number}</strong>.</p>
                {f'<p style="margin: 0 0 10px 0; color:#475569;">{sender_line}</p>' if sender_line else ''}

                <div style="background:#0f172a; color:#ffffff; text-align:center; padding:14px 18px; border-radius: 8px; letter-spacing: 4px; font-size: 24px; font-weight: 700; margin: 12px 0;">
                    {token}
                </div>

                <p style="margin: 0 0 12px 0;">Use this token to load the units onto your meter.</p>
                <p style="margin: 0 0 14px 0; color:#dc2626;">If you did not expect this token, contact support immediately.</p>

                <p style="margin: 0;">Best regards,<br/>gPawa Team</p>
            </div>
            <p style="font-size:12px; color:#6b7280; margin-top:12px;">Do not share this token with anyone else.</p>
        </div>
        """
        
        sent, email_message = send_email(
            sender=settings.DEFAULT_EMAIL_SENDER,
            recipients=[user.email],
            subject=subject,
            message=message,
            reply_to=[settings.DEFAULT_EMAIL_SENDER],
        )
        
        if sent:
            logger.info(f"[SHARE TOKEN] Email sent successfully to {user.email}")
            return True
        else:
            logger.error(f"[SHARE TOKEN] Failed to send email to {user.email}: {email_message}")
            return False
            
    except Exception as e:
        logger.exception(f"[SHARE TOKEN] Error in handle_send_share_token: {str(e)}")
        return False


@app.task()
def handle_send_low_units_alert_email(user_id, meter_no, units_kwh, notification_id):
    """Email alert when ThingsBoard reports low remaining units on an AMI meter."""
    try:
        user = User.objects.filter(pk=user_id).first()
        if not user or not user.email:
            logger.warning("[LOW UNITS] No user/email for notification %s", notification_id)
            return False

        frontend_url = settings.FRONTEND_URL.rstrip("/")
        meter_path = f"{frontend_url}/dashboard/tokens"
        subject = f"gPawa: Low units on meter {meter_no}"
        message = (
            f"<p>Hello {user.first_name or 'there'},</p>"
            f"<p>Your AMI meter <strong>{meter_no}</strong> is running low: "
            f"<strong>{units_kwh:.2f} kWh</strong> remaining.</p>"
            f"<p><a href=\"{meter_path}\">Open your meter dashboard</a> to check units or top up.</p>"
            f"<p>— gPawa Energy Wallet</p>"
        )

        sent, email_message = send_email(
            sender=settings.DEFAULT_EMAIL_SENDER,
            recipients=[user.email],
            subject=subject,
            message=message,
            reply_to=[settings.DEFAULT_EMAIL_SENDER],
        )
        if not sent:
            logger.error("[LOW UNITS] Failed to email user %s: %s", user.email, email_message)
        return sent
    except Exception as exc:
        logger.exception("[LOW UNITS] Email task error: %s", exc)
        return False


@app.task()
def handle_send_payment_receipt_email(
    user_id,
    amount_ugx,
    units_purchased,
    transaction_id,
    transaction_reference="",
):
    """Email receipt after a successful buy-units payment."""
    try:
        user = User.objects.filter(pk=user_id).first()
        if not user or not user.email:
            logger.warning("[PAYMENT RECEIPT] No user/email for transaction %s", transaction_id)
            return False

        frontend_url = settings.FRONTEND_URL.rstrip("/")
        subject = f"gPawa: Payment receipt #{transaction_id}"
        message = (
            f"<p>Hello {user.first_name or 'there'},</p>"
            "<p>Your payment was completed successfully.</p>"
            "<ul>"
            f"<li><strong>Amount paid:</strong> UGX {float(amount_ugx):,.2f}</li>"
            f"<li><strong>Units purchased:</strong> {float(units_purchased):.2f} kWh</li>"
            f"<li><strong>Transaction ID:</strong> {transaction_id}</li>"
            f"<li><strong>Reference:</strong> {transaction_reference or 'N/A'}</li>"
            "</ul>"
            f"<p><a href=\"{frontend_url}/dashboard/transactions\">View transaction history</a></p>"
            "<p>— gPawa Energy Wallet</p>"
        )

        sent, email_message = send_email(
            sender=settings.DEFAULT_EMAIL_SENDER,
            recipients=[user.email],
            subject=subject,
            message=message,
            reply_to=[settings.DEFAULT_EMAIL_SENDER],
        )
        if not sent:
            logger.error("[PAYMENT RECEIPT] Failed to email user %s: %s", user.email, email_message)
        return sent
    except Exception as exc:
        logger.exception("[PAYMENT RECEIPT] Email task error: %s", exc)
        return False
