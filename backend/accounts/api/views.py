

import logging
from accounts.tasks import handle_send_email_code, handle_send_email_verification
from utils.email import send_email
from utils.general import generate_numeric_id, get_base_url
from six import text_type
from django.utils.encoding import force_str as force_text
from django.conf import settings
from rest_framework import status, viewsets, mixins
from rest_framework.generics import (
    CreateAPIView,
    GenericAPIView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from drf_yasg.utils import swagger_auto_schema
from accounts.api.serializers import (
    CreateUserSerializer,
    LoginSerializer,
    LoginResponseSerializer,
    ResetPasswordConfirmSerializer,
    SettingsSerializer,
    UpdateAccountDetailsSerializer,
    UserAccountDetailsSerializer,
    UserConfigSerializer,
    ForgotPasswordSerializer,
    UpdateUserProfileSerializer,
    UserProfileSerializer
)
from accounts.models import SettingsConfirmationEmailCode, User, UserAccountDetails
from accounts.utils import (
    check_if_in_team,
    handle_post_email_verification,
    validate_user_hash,
    b64decode_hash,
    b64encode_user,
)
from utils.auth import token_generator, reset_password_token_generator
from utils.decorators import (
    class_view_decorator,
    required_fields,
    phone_verification_exempt,
)
from utils.exceptions import CustomAPIException
from django.db import connections
from django.db.utils import OperationalError
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from meter.models import Meter
from django.db.models import Sum
from meter.api.serializers import MeterSerializer
from loan.models import LoanApplication
from loan.api.serializers import LoanApplicationSerializer

logger = logging.getLogger(__name__)

PASSWORD_RESET_SUBJECT = "Power Cred: Reset Your Password"
 
# import logging
# from accounts.tasks import handle_send_email_code, handle_send_email_verification
# from utils.email import send_email
# from utils.general import generate_numeric_id, get_base_url
# from six import text_type
# from django.utils.encoding import force_str as force_text
# from django.conf import settings
# from rest_framework import status, viewsets, mixins
# from rest_framework.generics import (
#     CreateAPIView,
#     GenericAPIView,
# )
# from rest_framework.permissions import AllowAny, IsAuthenticated
# from rest_framework_simplejwt.views import TokenObtainPairView
# from rest_framework.response import Response
# from drf_yasg.utils import swagger_auto_schema
# from accounts.api.serializers import (
#     CreateUserSerializer,
#     LoginSerializer,
#     LoginResponseSerializer,
#     ResetPasswordConfirmSerializer,
#     SettingsSerializer,
#     UpdateAccountDetailsSerializer,
#     UserAccountDetailsSerializer,
#     UserConfigSerializer,
#     ForgotPasswordSerializer
   
# )
# from accounts.models import SettingsConfirmationEmailCode, User, UserAccountDetails
# from accounts.utils import (
#     check_if_in_team,
#     handle_post_email_verification,
#     validate_user_hash,
#     b64decode_hash,
#     b64encode_user,
# )
# from utils.auth import token_generator, reset_password_token_generator
# from utils.decorators import (
#     class_view_decorator,
#     required_fields,
#     phone_verification_exempt,
# )
# from utils.exceptions import CustomAPIException
# from django.db import connections
# from django.db.utils import OperationalError
# from django.db.models import Q
# from rest_framework import status
# from rest_framework.decorators import api_view, permission_classes
# from rest_framework.permissions import IsAuthenticated
# from meter.models import Meter
# from django.db.models import Sum
# from meter.api.serializers import MeterSerializer
# from loan.models import LoanApplication
# from loan.api.serializers import LoanApplicationSerializer
# from loan.api.views import LoanRepayment

# logger = logging.getLogger(__name__)

# PASSWORD_RESET_SUBJECT = "Power Cred: Reset Your Password"
 
# @api_view(['GET', 'POST'])
# @permission_classes([IsAuthenticated])
# def user_profile_view(request):
#     if request.method == 'GET':
#         # Return user profile data
#         user = request.user
#         profile_data = {
#             'monthly_expenditure': user.monthly_expenditure,
#             'purchase_frequency': user.purchase_frequency,
#             'payment_consistency': user.payment_consistency,
#             'disconnection_history': user.disconnection_history,
#             'meter_sharing': user.meter_sharing,
#             'monthly_income': user.monthly_income,
#             'income_stability': user.income_stability,
#             'consumption_level': user.consumption_level,
#             'completed': user.has_complete_profile
#         }
#         return Response(profile_data)
    
#     elif request.method == 'POST':
#         # Update user profile data
#         user = request.user
#         data = request.data
        
#         # Update user fields
#         fields = [
#             'monthly_expenditure', 'purchase_frequency', 'payment_consistency',
#             'disconnection_history', 'meter_sharing', 'monthly_income',
#             'income_stability', 'consumption_level'
#         ]
        
#         for field in fields:
#             if field in data:
#                 setattr(user, field, data[field])
        
#         user.save()
        
#         return Response({
#             "success": "Profile updated successfully",
#             "completed": user.has_complete_profile
#         })

# class UserProfileAPIView(GenericAPIView):
#     """
#     Comprehensive user profile endpoint that combines:
#     - User config
#     - Meter info
#     - Loan history
#     - Profile completion status
#     """
#     permission_classes = [IsAuthenticated]
    
#     def get(self, request):
#         try:
#             user = request.user
#             logger.info(f"Fetching profile for user: {user.id} - {user.email}")
            
#             # Get basic user config
#             user_serializer = UserConfigSerializer(user)
#             user_data = user_serializer.data
#             logger.info(f"User data: {user_data}")
            
#             # Safely get account details
#             account_details = user_data.get('account_details')
#             logger.info(f"Account details: {account_details}")
            
#             # Get meter information
#             try:
#                 meter = Meter.objects.get(user=user)
#                 meter_serializer = MeterSerializer(meter)
#                 meter_data = meter_serializer.data
#                 meter_data['has_meter'] = True
#                 logger.info(f"Meter found: {meter_data}")
#             except Meter.DoesNotExist:
#                 meter_data = {
#                     'has_meter': False,
#                     'meter_no': None,
#                     'static_ip': None,
#                     'units': 0
#                 }
#                 logger.info("No meter found for user")
            
#             # Get recent loans
#             loans = LoanApplication.objects.filter(user=user).order_by('-created_at')[:5]
#             loan_serializer = LoanApplicationSerializer(loans, many=True)
#             logger.info(f"Found {loans.count()} loans")
            
#             # Check profile completion
#             completed = self.check_profile_completion(user, account_details)
#             logger.info(f"Profile completion status: {completed}")
            
#             # Build response
#             response_data = {
#                 'user': {
#                     'id': user.id,
#                     'email': user.email,
#                     'first_name': user.first_name,
#                     'last_name': user.last_name,
#                     'phone_number': user.phone_number,
#                     'is_admin': user.is_admin or user.user_role == User.ADMIN,
#                     'user_role': user.user_role,
#                     'email_verified': user.profile.email_verified if hasattr(user, 'profile') else False,
#                 },
#                 'meter': meter_data,
#                 'recent_loans': loan_serializer.data,
#                 'completed': completed,
#                 'profile_completion': {
#                     'has_meter': meter_data['has_meter'],
#                     'has_complete_profile': completed,
#                     'setup_complete': completed and meter_data['has_meter']
#                 }
#             }
            
#             # Add account details if they exist
#             if account_details:
#                 response_data['account_details'] = account_details
            
#             # Add user profile data if available
#             profile_data = {}
#             profile_fields = [
#                 'monthly_expenditure',
#                 'purchase_frequency', 
#                 'payment_consistency',
#                 'disconnection_history',
#                 'meter_sharing',
#                 'monthly_income',
#                 'income_stability',
#                 'consumption_level'
#             ]
            
#             for field in profile_fields:
#                 value = getattr(user, field, None)
#                 if value:
#                     profile_data[field] = value
            
#             if profile_data:
#                 response_data['profile_data'] = profile_data
            
#             logger.info(f"Returning profile data for user {user.id}")
#             return Response(response_data, status=status.HTTP_200_OK)
            
#         except Exception as e:
#             logger.exception(f"Error in UserProfileAPIView: {str(e)}")
#             return Response(
#                 {"error": "Failed to fetch user profile", "detail": str(e)},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             )
    
#     def check_profile_completion(self, user, account_details):
#         """Check if user has completed their profile"""
#         try:
#             # Check if user has all required basic fields
#             required_fields = [
#                 user.first_name,
#                 user.last_name,
#                 user.email,
#                 user.phone_number,
#             ]
            
#             # Check if account details exist and have address
#             has_account_details = False
#             if account_details:
#                 # Handle both dictionary and string representation
#                 if isinstance(account_details, dict):
#                     has_account_details = bool(account_details.get('address'))
#                 else:
#                     # Try to parse if it's a string representation
#                     try:
#                         import ast
#                         if isinstance(account_details, str):
#                             details_dict = ast.literal_eval(account_details)
#                             has_account_details = bool(details_dict.get('address'))
#                     except:
#                         has_account_details = False
            
#             # Check if user has provided profile assessment data
#             profile_fields = [
#                 'monthly_expenditure',
#                 'purchase_frequency',
#                 'payment_consistency',
#                 'disconnection_history',
#                 'meter_sharing',
#                 'monthly_income',
#                 'income_stability',
#                 'consumption_level'
#             ]
            
#             has_profile_data = True
#             for field in profile_fields:
#                 value = getattr(user, field, None)
#                 if not value:
#                     has_profile_data = False
#                     break
            
#             logger.info(f"Profile completion check: basic={all(required_fields)}, account={has_account_details}, profile={has_profile_data}")
            
#             return all(required_fields) and has_account_details and has_profile_data
            
#         except Exception as e:
#             logger.error(f"Error checking profile completion: {str(e)}")
#             return False


# class UpdateUserProfileAPIView(GenericAPIView):
#     """
#     Update user profile assessment data
#     """
#     permission_classes = [IsAuthenticated]
    
#     def post(self, request):
#         try:
#             user = request.user
#             data = request.data
            
#             logger.info(f"Updating profile for user {user.id} with data: {data}")
            
#             # Update profile assessment fields
#             profile_fields = [
#                 'monthly_expenditure',
#                 'purchase_frequency', 
#                 'payment_consistency',
#                 'disconnection_history',
#                 'meter_sharing',
#                 'monthly_income',
#                 'income_stability',
#                 'consumption_level'
#             ]
            
#             updated_fields = []
#             for field in profile_fields:
#                 if field in data:
#                     value = data[field]
#                     if value:  # Only update if value is not empty
#                         setattr(user, field, value)
#                         updated_fields.append(field)
#                         logger.info(f"Updated {field} to {value}")
            
#             if updated_fields:
#                 user.save()
#                 logger.info(f"User {user.id} updated profile fields: {updated_fields}")
            
#             # Check completion status
#             # Get account details from user_data
#             from .serializers import UserConfigSerializer
#             user_serializer = UserConfigSerializer(user)
#             user_data = user_serializer.data
#             account_details = user_data.get('account_details', {})
            
#             completed = UserProfileAPIView.check_profile_completion(self, user, account_details)
            
#             return Response({
#                 "success": True,
#                 "message": "Profile updated successfully",
#                 "updated_fields": updated_fields,
#                 "completed": completed
#             }, status=status.HTTP_200_OK)
            
#         except Exception as e:
#             logger.exception(f"Error updating user profile: {str(e)}")
#             return Response(
#                 {"error": "Failed to update profile", "detail": str(e)},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             )

# class LoginAPIView(TokenObtainPairView):
#     """
#     Login API. Expects an email and password
#     :returns: access and refresh token
#     """

#     serializer_class = LoginSerializer

#     @swagger_auto_schema(responses={200: LoginResponseSerializer()})
#     def post(self, request, *args, **kwargs):
#         return super().post(request, *args, **kwargs)
#         if response.status_code == 200:
#             # Get the user from serializer context
#             serializer = self.get_serializer(data=request.data)
#             if serializer.is_valid():
#                 user = serializer.user
#                 # Add user info to response
#                 response.data.update({
#                     'user_role': user.user_role,
#                     'is_admin': user.user_role == User.ADMIN,
#                     'email': user.email,
#                     'first_name': user.first_name,
#                     'last_name': user.last_name,
#                     'redirect_to': '/admin/dashboard' if user.user_role == User.ADMIN else '/dashboard'
#                 })
        
#         return response


# class LoginAPIView(TokenObtainPairView):
#     """
#     Login API. Expects an email and password
#     :returns: access and refresh token + user info
#     """

#     serializer_class = LoginSerializer

#     @swagger_auto_schema(responses={200: LoginResponseSerializer()})
#     def post(self, request, *args, **kwargs):
#         # Call the parent to get the normal token response
#         response = super().post(request, *args, **kwargs)

#         # Only modify if login was successful
#         if response.status_code == 200:
#             # Get the authenticated user
#             serializer = self.get_serializer(data=request.data)
#             serializer.is_valid(raise_exception=True)  # This will raise if invalid
#             user = serializer.user

#             # Add custom user data to the response
#             response.data.update({
#                 'user': {
#                     'id': user.id,
#                     'email': user.email,
#                     'first_name': user.first_name,
#                     'last_name': user.last_name,
#                     'user_role': user.user_role,
#                     'is_admin': user.user_role == User.ADMIN,
#                     'redirect_to': '/admin/dashboard' if user.user_role == User.ADMIN else '/dashboard'
#                 }
#             })

#         return response


# class CreateUserAPIView(CreateAPIView):
#     """
#     API view for registering a user
#     """

#     permission_classes = (AllowAny,)
#     serializer_class = CreateUserSerializer

#     def post(self, request, *args, **kwargs):
#         logger.info(f"[REGISTRATION] Starting registration with data: {request.data}")
#         serializer = self.serializer_class(data=request.data)
#         serializer.is_valid(raise_exception=True)
#         user = serializer.save()

#         logger.info(f"[REGISTRATION] User {user.id} created successfully")

#         # For development: Send email synchronously instead of using Celery
#         if settings.DEBUG:
#             logger.info(f"[REGISTRATION] DEBUG mode: Sending email synchronously")
#             from accounts.tasks import handle_send_email_verification
#             handle_send_email_verification(user.id)  # Call synchronously
#         else:
#             # Production: Use Celery
#             handle_send_email_verification.delay(user.id)

#         response_data = {
#             "success": True,
#             "message": "User registered successfully!",
#         }

#         return Response(response_data, status=status.HTTP_201_CREATED)


# class VerifyEmailAPIView(GenericAPIView):
#     """
#     API view for verifying a user's email account
#     """

#     permission_classes = (AllowAny,)

#     @required_fields(["uid", "token"])
#     def get(self, request):
#         error_msg = "Invalid activation link"
#         user_hash = request.query_params.get("uid")
#         token = request.query_params.get("token")
        
#         logger.info(f"[EMAIL VERIFICATION] Starting verification with uid: {user_hash}, token: {token}")
        
#         try:
#             _, user_id = b64decode_hash(user_hash)
#             user = User.objects.get(pk=user_id)
#             logger.info(f"[EMAIL VERIFICATION] Found user: {user.id}, email: {user.email}")
#         except User.DoesNotExist:
#             logger.error(f"[EMAIL VERIFICATION] User not found for hash: {user_hash}")
#             raise CustomAPIException(message=error_msg)
#         except Exception as e:
#             logger.exception(
#                 f"[EMAIL VERIFICATION] Error while decoding user_hash."
#                 f" Error: {text_type(e)}"
#             )
#             raise CustomAPIException(message=error_msg)

#         logger.info(f"[EMAIL VERIFICATION] Checking token for user {user.id}")
#         if token_generator.check_token(user, token):
#             profile = user.profile
#             profile.email_verified = True
#             profile.save()

#             logger.info(
#                 f"[EMAIL VERIFICATION] Email verified for user {user.id}"
#             )

#             handle_post_email_verification(user)

#             response_data = {
#                 "message": "User account verified successfully!",
#             }
#             return Response(response_data, status=status.HTTP_200_OK)
#         else:
#             logger.error(f"[EMAIL VERIFICATION] Invalid token for user {user.id}")
#             raise CustomAPIException(message=error_msg)


# @class_view_decorator(phone_verification_exempt)
# class UserConfigAPIView(GenericAPIView):
#     permission_classes = [
#         IsAuthenticated
#     ]
#     serializer_class = UserConfigSerializer

#     def get(self, request):
#         print(f"[USER CONFIG] User: {request.user}, Authenticated: {request.user.is_authenticated}")
#         print(f"[USER CONFIG] User ID: {request.user.id if request.user.is_authenticated else 'None'}")
#         user = request.user
#         serializer = self.serializer_class(user)
#         return Response(serializer.data, status=status.HTTP_200_OK)


# class ForgotPasswordAPIView(GenericAPIView):
#     permission_classes = [AllowAny]
#     serializer_class = ForgotPasswordSerializer

#     def post(self, request):
#         serializer = self.serializer_class(data=request.data)
#         serializer.is_valid(raise_exception=True)
#         email = request.data.get("email")
#         message = (
#             "Thanks! If there's an account associated with this email. "
#             " We'll send password reset instructions immediately."
#         )
#         response_data = {"message": message}

#         try:
#             user = User.objects.get(email=email)
#         except User.DoesNotExist as e:
#             logger.exception(
#                 f"[FORGOT PASSWORD]] User with email {email} does not exist.\n"
#                 f"Error: {text_type(e)}"
#             )
#             return Response(response_data, status=status.HTTP_200_OK)

#         token = reset_password_token_generator.make_token(user)
#         user_hash = b64encode_user(force_text(user.pk))
#         url = f"{get_base_url()}/auth/reset-password/?uid={user_hash}&token={token}"
#         message = (
#             f"You requested for a password reset for your account. "
#             f"Please click the link below to continue"
#             f"with resetting your password.\n\n{url}\n\n"
#             f"If you did not request this, please ignore the email.\n\n"
#         )
#         logger.info(
#             f"[ACCOUNTS] About to send password reset email "
#             f"email to user {user.pk}"
#         )

#         #  trigger with rabbitmq
#         sent, message = send_email(
#             sender=settings.DEFAULT_EMAIL_SENDER,
#             recipients=[user.email],
#             subject=PASSWORD_RESET_SUBJECT,
#             message=message,
#             reply_to=[settings.DEFAULT_EMAIL_SENDER],
#         )
#         logger.info(
#             f"[ACCOUNTS] Password reset. Sent: {sent}, message: {message},"
#             f" user: {user.pk}"
#         )
#         message = (
#             "Thanks! If there's an account associated with this email, "
#             "we'll send password reset instructions immediately."
#         )
#         response_data = {
#             "message": message,
#         }
#         return Response(response_data, status=status.HTTP_200_OK)


# class ResetPasswordAPIView(GenericAPIView):
#     permission_classes = [AllowAny]
#     serializer_class = ResetPasswordConfirmSerializer

#     @required_fields(["uid", "token"])
#     def get(self, request):
#         """Method to validate and verify the password reset uid and token"""
#         user_hash = request.query_params.get("uid")
#         token = request.query_params.get("token")
#         user = validate_user_hash(user_hash)
#         error_message = "Invalid reset password link!"

#         if not user:
#             raise CustomAPIException(message=error_message)

#         if reset_password_token_generator.check_token(user, token):
#             logger.info(
#                 f"[RESET PASSWORD] Link for user account {user.id} "
#                 f"verified successfully"
#             )
#             response_data = {
#                 "message": "Account and token verified successfully!",
#             }
#             return Response(response_data, status=status.HTTP_200_OK)
#         else:
#             raise CustomAPIException(message=error_message)

#     @required_fields(["uid", "token"])
#     def patch(self, request):
#         """Method to update the user's password"""
#         user_hash = request.query_params.get("uid")
#         token = request.query_params.get("token")
#         error_message = "Invalid reset password link!"
#         user = validate_user_hash(user_hash)

#         if not user:
#             raise CustomAPIException(message=error_message)

#         if not reset_password_token_generator.check_token(user, token):
#             raise CustomAPIException(message=error_message)

#         data = request.data
#         serializer = self.serializer_class(data=data)
#         serializer.is_valid(raise_exception=True)

#         user.set_password(data.get("password"))
#         user.save()
#         logger.info(
#             f"[RESET PASSWORD] User {user.id} password reset successfully!"
#         )

#         return Response(
#             {
#                 "message": "Password reset successfully!",
#             },
#             status=status.HTTP_200_OK,
#         )



#     # model = Wallet
#     # serializer_class = WalletSerializer
#     # permission_classes = [
#     #     IsAuthenticated
#     # ]

#     # def get_queryset(self):
#     #     queryset = Wallet.objects.filter(
#     #         user__is_active=True,
#     #         user=self.request.user,
#     #     )
#     #     return queryset


# class SettingsAPIView(CreateAPIView):
#     """
#     API view for changing a user settings
#     """

#     permission_classes = (IsAuthenticated,)
#     serializer_class = SettingsSerializer

#     def post(self, request, *args, **kwargs):
#         try:
#             serializer = self.serializer_class(data=request.data, context=request)
#             serializer.is_valid(raise_exception=True)
#             serializer.save()

#             response_data = {
#                 "success": True,
#                 "message": "User settings updated successfully!",
#             }

#             return Response(response_data, status=status.HTTP_201_CREATED)
#         except Exception as exc:
#             return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

#     # send an email for verification
#     def get(self, request, *args, **kwargs):
#         user = request.user

#         existing_code = SettingsConfirmationEmailCode.objects.filter(user=user).first()

#         if existing_code:
#             code = existing_code.code
#         else:
#             code = generate_numeric_id(6)

#             SettingsConfirmationEmailCode.objects.create(
#                 user=user,
#                 code=code
#             )

#         handle_send_email_code.delay(user.id, code)

#         response_data = {
#             "success": True,
#             "message": "Confirmation code sent",
#         }

#         return Response(response_data, status=status.HTTP_201_CREATED)


# class ResendVerificationEmailAPIView(GenericAPIView):
#     """
#     API view for resending verification emails to users
#     """

#     permission_classes = (AllowAny,)

#     @required_fields(["email"])
#     def get(self, request):
#         email = request.query_params.get("email")
#         logger.info(request.query_params)
#         error_msg = "We have encountered an error resending the verification link"
#         try:
#             user = User.objects.get(email=email)
#         except User.DoesNotExist:
#             raise CustomAPIException(message=error_msg + f": Does Not Exist : {email}")
#         except Exception as e:
#             logger.exception(
#                 f"[EMAIL VERIFICATION] Error while resending an email"
#                 f" Error: {text_type(e)}"
#             )
#             raise CustomAPIException(message=error_msg + f" Error: {text_type(e)}")

#         # check if the email is verified
#         profile = user.profile
#         if profile.email_verified:
#             error_msg = "Email address is already verified"
#             raise CustomAPIException(message=error_msg)

#         # send the email now
#         handle_send_email_verification.delay(user.id)

#         response_data = {
#             "message": "Verification email sent successfully!",
#         }
#         return Response(response_data, status=status.HTTP_200_OK)


# class AccountDetailsAPIView(GenericAPIView):
#     permission_classes = [IsAuthenticated]
#     serializer_class = UserAccountDetailsSerializer
    
#     def get(self, request):
#         try:
#             # Get or create account details for the user
#             account_details, created = UserAccountDetails.objects.get_or_create(
#                 user=request.user
#             )
#             serializer = self.serializer_class(account_details)
#             return Response(serializer.data, status=status.HTTP_200_OK)
#         except Exception as e:
#             logger.exception(f"Error fetching account details: {str(e)}")
#             return Response(
#                 {"error": "Failed to fetch account details"}, 
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             )



# class UserConfigAPIView(GenericAPIView):
#     permission_classes = [IsAuthenticated]
#     serializer_class = UserConfigSerializer

#     def get(self, request):
#         user = request.user
#         user = User.objects.prefetch_related('account_details').get(id=user.id)
#         serializer = self.serializer_class(user)
#         return Response(serializer.data, status=status.HTTP_200_OK)


# class UpdateAccountDetailsAPIView(GenericAPIView):
#     permission_classes = [IsAuthenticated]
#     serializer_class = UpdateAccountDetailsSerializer
    
#     def patch(self, request):
#         try:
#             logger.info(f"=== UPDATE ACCOUNT DETAILS REQUEST ===")
#             logger.info(f"User: {request.user.id} - {request.user.email}")
#             logger.info(f"Request data: {request.data}")
            
#             # Get or create account details for the user
#             try:
#                 account_details = UserAccountDetails.objects.get(user=request.user)
#                 logger.info(f"Found existing account details: {account_details.id}")
#             except UserAccountDetails.DoesNotExist:
#                 logger.info("Account details don't exist, creating new ones")
#                 account_details = UserAccountDetails.objects.create(user=request.user)
#                 logger.info(f"Created new account details: {account_details.id}")
            
#             serializer = self.serializer_class(
#                 account_details, 
#                 data=request.data, 
#                 partial=True
#             )
            
#             if not serializer.is_valid():
#                 logger.error(f"Serializer validation errors: {serializer.errors}")
#                 return Response(
#                     {"error": "Invalid data", "details": serializer.errors},
#                     status=status.HTTP_400_BAD_REQUEST
#                 )
                
#             logger.info("Serializer is valid, saving data...")
#             instance = serializer.save()
#             logger.info(f"Successfully saved: {instance.__dict__}")
            
#             return Response(
#                 {"message": "Account details updated successfully"},
#                 status=status.HTTP_200_OK
#             )
#         except Exception as e:
#             logger.exception(f"CRITICAL ERROR updating account details: {str(e)}")
#             return Response(
#                 {"error": "Failed to update account details", "details": str(e)}, 
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             )



class UserProfileAPIView(GenericAPIView):
    """
    Comprehensive user profile endpoint that combines:
    - User config
    - Meter info
    - Loan history
    - Profile completion status
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer
    
    def get(self, request):
        try:
            user = request.user
            logger.info(f"Fetching profile for user: {user.id} - {user.email}")
            
            # Get basic user config
            user_serializer = UserConfigSerializer(user)
            user_data = user_serializer.data
            logger.info(f"User data: {user_data}")
            
            # Safely get account details
            account_details = user_data.get('account_details')
            logger.info(f"Account details: {account_details}")
            
            # Get meter information
            try:
                meter = Meter.objects.get(user=user)
                meter_serializer = MeterSerializer(meter)
                meter_data = meter_serializer.data
                meter_data['has_meter'] = True
                logger.info(f"Meter found: {meter_data}")
            except Meter.DoesNotExist:
                meter_data = {
                    'has_meter': False,
                    'meter_no': None,
                    'static_ip': None,
                    'units': 0
                }
                logger.info("No meter found for user")
            
            # Get recent loans
            loans = LoanApplication.objects.filter(user=user).order_by('-created_at')[:5]
            loan_serializer = LoanApplicationSerializer(loans, many=True)
            logger.info(f"Found {loans.count()} loans")
            
            # Check profile completion
            completed = self.check_profile_completion(user, account_details)
            logger.info(f"Profile completion status: {completed}")
            
            # Get profile data
            profile_serializer = UserProfileSerializer(user)
            profile_data = profile_serializer.data
            
            # Build response
            response_data = {
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'phone_number': str(user.phone_number) if user.phone_number else None,  # Convert to string
                    'is_admin': user.is_admin or user.user_role == User.ADMIN,
                    'user_role': user.user_role,
                    'email_verified': user.profile.email_verified if hasattr(user, 'profile') else False,
                },
                'meter': meter_data,
                'recent_loans': loan_serializer.data,
                'completed': completed,
                'profile_completion': {
                    'has_meter': meter_data['has_meter'],
                    'has_complete_profile': completed,
                    'setup_complete': completed and meter_data['has_meter']
                },
                'profile_data': profile_data
            }
            
            # Add account details if they exist
            if account_details:
                response_data['account_details'] = account_details
            
            logger.info(f"Returning profile data for user {user.id}")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.exception(f"Error in UserProfileAPIView: {str(e)}")
            return Response(
                {"error": "Failed to fetch user profile", "detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # def check_profile_completion(self, user, account_details):
    #     """Check if user has completed their profile"""
    #     try:
    #         # Check if user has all required basic fields
    #         required_fields = [
    #             user.first_name,
    #             user.last_name,
    #             user.email,
    #             user.phone_number,
    #         ]
            
    #         # Check if all basic fields are filled
    #         if not all(required_fields):
    #             logger.info(f"Missing basic fields for user {user.id}")
    #             return False
            
    #         # Check if account details exist and have address
    #         has_account_details = False
    #         if account_details:
    #             # Handle both dictionary and string representation
    #             if isinstance(account_details, dict):
    #                 has_account_details = bool(account_details.get('address'))
    #             else:
    #                 # Try to parse if it's a string representation
    #                 try:
    #                     import ast
    #                     if isinstance(account_details, str):
    #                         details_dict = ast.literal_eval(account_details)
    #                         has_account_details = bool(details_dict.get('address'))
    #                 except:
    #                     has_account_details = False
            
    #         # Check if user has provided profile assessment data
    #         profile_fields = [
    #             'monthly_expenditure',
    #             'purchase_frequency',
    #             'payment_consistency',
    #             'disconnection_history',
    #             'meter_sharing',
    #             'monthly_income',
    #             'income_stability',
    #             'consumption_level'
    #         ]
            
    #         has_profile_data = True
    #         for field in profile_fields:
    #             value = getattr(user, field, None)
    #             if not value:
    #                 has_profile_data = False
    #                 logger.info(f"Missing profile field: {field}")
    #                 break
            
    #         logger.info(f"Profile completion check: basic={all(required_fields)}, account={has_account_details}, profile={has_profile_data}")
            
    #         return all(required_fields) and has_account_details and has_profile_data
            
    #     except Exception as e:
    #         logger.error(f"Error checking profile completion: {str(e)}")
    #         return False
    
    # In the UserProfileAPIView class, update the check_profile_completion method:

    def check_profile_completion(self, user, account_details):
        """Check if user has completed their profile"""
        try:
            # Check if user has all required basic fields
            required_fields = [
                user.first_name,
                user.last_name,
                user.email,
                user.phone_number,
            ]

            # Check if all basic fields are filled
            if not all(required_fields):
                logger.info(f"Missing basic fields for user {user.id}")
                return False

            # Check if user has provided profile assessment data
            profile_fields = [
                'monthly_expenditure',
                'purchase_frequency',
                'payment_consistency',
                'disconnection_history',
                'meter_sharing',
                'monthly_income',
                'income_stability',
                'consumption_level'
            ]

            has_profile_data = True
            for field in profile_fields:
                value = getattr(user, field, None)
                if not value:
                    has_profile_data = False
                    logger.info(f"Missing profile field: {field}")
                    break

            logger.info(f"Profile completion check: basic={all(required_fields)}, profile={has_profile_data}")

            # Profile is complete if user has all basic fields and profile assessment data
            return all(required_fields) and has_profile_data

        except Exception as e:
            logger.error(f"Error checking profile completion: {str(e)}")
            return False


    def post(self, request):
        """Update user profile data"""
        try:
            user = request.user
            data = request.data
            
            logger.info(f"Updating profile for user {user.id} with data: {data}")
            
            # Use the UpdateUserProfileSerializer
            serializer = UpdateUserProfileSerializer(data=data)
            if not serializer.is_valid():
                logger.error(f"Serializer validation errors: {serializer.errors}")
                return Response(
                    {"error": "Invalid data", "details": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update user fields
            validated_data = serializer.validated_data
            updated_fields = []
            for field, value in validated_data.items():
                if value is not None:
                    setattr(user, field, value)
                    updated_fields.append(field)
                    logger.info(f"Updated {field} to {value}")
            
            if updated_fields:
                user.save()
                logger.info(f"User {user.id} updated profile fields: {updated_fields}")
            
            # Check completion status
            user_serializer = UserConfigSerializer(user)
            user_data = user_serializer.data
            account_details = user_data.get('account_details', {})
            
            completed = self.check_profile_completion(user, account_details)
            
            return Response({
                "success": True,
                "message": "Profile updated successfully",
                "updated_fields": updated_fields,
                "completed": completed
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.exception(f"Error updating user profile: {str(e)}")
            return Response(
                {"error": "Failed to update profile", "detail": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LoginAPIView(TokenObtainPairView):
    """
    Login API. Expects an email and password
    :returns: access and refresh token + user info
    """

    serializer_class = LoginSerializer

    @swagger_auto_schema(responses={200: LoginResponseSerializer()})
    def post(self, request, *args, **kwargs):
        # Call the parent to get the normal token response
        response = super().post(request, *args, **kwargs)

        # Only modify if login was successful
        if response.status_code == 200:
            # Get the authenticated user
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)  # This will raise if invalid
            user = serializer.user

            # Add custom user data to the response
            response.data.update({
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_role': user.user_role,
                    'is_admin': user.user_role == User.ADMIN,
                    'redirect_to': '/admin/dashboard' if user.user_role == User.ADMIN else '/dashboard'
                }
            })

        return response


class CreateUserAPIView(CreateAPIView):
    """
    API view for registering a user
    """

    permission_classes = (AllowAny,)
    serializer_class = CreateUserSerializer

    def post(self, request, *args, **kwargs):
        logger.info(f"[REGISTRATION] Starting registration with data: {request.data}")
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        logger.info(f"[REGISTRATION] User {user.id} created successfully")

        # For development: Send email synchronously instead of using Celery
        if settings.DEBUG:
            logger.info(f"[REGISTRATION] DEBUG mode: Sending email synchronously")
            from accounts.tasks import handle_send_email_verification
            handle_send_email_verification(user.id)  # Call synchronously
        else:
            # Production: Use Celery
            handle_send_email_verification.delay(user.id)

        response_data = {
            "success": True,
            "message": "User registered successfully!",
        }

        return Response(response_data, status=status.HTTP_201_CREATED)


class VerifyEmailAPIView(GenericAPIView):
    """
    API view for verifying a user's email account
    """

    permission_classes = (AllowAny,)

    @required_fields(["uid", "token"])
    def get(self, request):
        error_msg = "Invalid activation link"
        user_hash = request.query_params.get("uid")
        token = request.query_params.get("token")
        
        logger.info(f"[EMAIL VERIFICATION] Starting verification with uid: {user_hash}, token: {token}")
        
        try:
            _, user_id = b64decode_hash(user_hash)
            user = User.objects.get(pk=user_id)
            logger.info(f"[EMAIL VERIFICATION] Found user: {user.id}, email: {user.email}")
        except User.DoesNotExist:
            logger.error(f"[EMAIL VERIFICATION] User not found for hash: {user_hash}")
            raise CustomAPIException(message=error_msg)
        except Exception as e:
            logger.exception(
                f"[EMAIL VERIFICATION] Error while decoding user_hash."
                f" Error: {text_type(e)}"
            )
            raise CustomAPIException(message=error_msg)

        logger.info(f"[EMAIL VERIFICATION] Checking token for user {user.id}")
        if token_generator.check_token(user, token):
            profile = user.profile
            profile.email_verified = True
            profile.save()

            logger.info(
                f"[EMAIL VERIFICATION] Email verified for user {user.id}"
            )

            handle_post_email_verification(user)

            response_data = {
                "message": "User account verified successfully!",
            }
            return Response(response_data, status=status.HTTP_200_OK)
        else:
            logger.error(f"[EMAIL VERIFICATION] Invalid token for user {user.id}")
            raise CustomAPIException(message=error_msg)


@class_view_decorator(phone_verification_exempt)
class UserConfigAPIView(GenericAPIView):
    permission_classes = [
        IsAuthenticated
    ]
    serializer_class = UserConfigSerializer

    def get(self, request):
        print(f"[USER CONFIG] User: {request.user}, Authenticated: {request.user.is_authenticated}")
        print(f"[USER CONFIG] User ID: {request.user.id if request.user.is_authenticated else 'None'}")
        user = request.user
        serializer = self.serializer_class(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ForgotPasswordAPIView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = ForgotPasswordSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = request.data.get("email")
        message = (
            "Thanks! If there's an account associated with this email. "
            " We'll send password reset instructions immediately."
        )
        response_data = {"message": message}

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist as e:
            logger.exception(
                f"[FORGOT PASSWORD]] User with email {email} does not exist.\n"
                f"Error: {text_type(e)}"
            )
            return Response(response_data, status=status.HTTP_200_OK)

        token = reset_password_token_generator.make_token(user)
        user_hash = b64encode_user(force_text(user.pk))
        url = f"{get_base_url()}/auth/reset-password/?uid={user_hash}&token={token}"
        message = (
            f"You requested for a password reset for your account. "
            f"Please click the link below to continue"
            f"with resetting your password.\n\n{url}\n\n"
            f"If you did not request this, please ignore the email.\n\n"
        )
        logger.info(
            f"[ACCOUNTS] About to send password reset email "
            f"email to user {user.pk}"
        )

        #  trigger with rabbitmq
        sent, message = send_email(
            sender=settings.DEFAULT_EMAIL_SENDER,
            recipients=[user.email],
            subject=PASSWORD_RESET_SUBJECT,
            message=message,
            reply_to=[settings.DEFAULT_EMAIL_SENDER],
        )
        logger.info(
            f"[ACCOUNTS] Password reset. Sent: {sent}, message: {message},"
            f" user: {user.pk}"
        )
        message = (
            "Thanks! If there's an account associated with this email, "
            "we'll send password reset instructions immediately."
        )
        response_data = {
            "message": message,
        }
        return Response(response_data, status=status.HTTP_200_OK)


class ResetPasswordAPIView(GenericAPIView):
    permission_classes = [AllowAny]
    serializer_class = ResetPasswordConfirmSerializer

    @required_fields(["uid", "token"])
    def get(self, request):
        """Method to validate and verify the password reset uid and token"""
        user_hash = request.query_params.get("uid")
        token = request.query_params.get("token")
        user = validate_user_hash(user_hash)
        error_message = "Invalid reset password link!"

        if not user:
            raise CustomAPIException(message=error_message)

        if reset_password_token_generator.check_token(user, token):
            logger.info(
                f"[RESET PASSWORD] Link for user account {user.id} "
                f"verified successfully"
            )
            response_data = {
                "message": "Account and token verified successfully!",
            }
            return Response(response_data, status=status.HTTP_200_OK)
        else:
            raise CustomAPIException(message=error_message)

    @required_fields(["uid", "token"])
    def patch(self, request):
        """Method to update the user's password"""
        user_hash = request.query_params.get("uid")
        token = request.query_params.get("token")
        error_message = "Invalid reset password link!"
        user = validate_user_hash(user_hash)

        if not user:
            raise CustomAPIException(message=error_message)

        if not reset_password_token_generator.check_token(user, token):
            raise CustomAPIException(message=error_message)

        data = request.data
        serializer = self.serializer_class(data=data)
        serializer.is_valid(raise_exception=True)

        user.set_password(data.get("password"))
        user.save()
        logger.info(
            f"[RESET PASSWORD] User {user.id} password reset successfully!"
        )

        return Response(
            {
                "message": "Password reset successfully!",
            },
            status=status.HTTP_200_OK,
        )


class SettingsAPIView(CreateAPIView):
    """
    API view for changing a user settings
    """

    permission_classes = (IsAuthenticated,)
    serializer_class = SettingsSerializer

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.serializer_class(data=request.data, context=request)
            serializer.is_valid(raise_exception=True)
            serializer.save()

            response_data = {
                "success": True,
                "message": "User settings updated successfully!",
            }

            return Response(response_data, status=status.HTTP_201_CREATED)
        except Exception as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

    # send an email for verification
    def get(self, request, *args, **kwargs):
        user = request.user

        existing_code = SettingsConfirmationEmailCode.objects.filter(user=user).first()

        if existing_code:
            code = existing_code.code
        else:
            code = generate_numeric_id(6)

            SettingsConfirmationEmailCode.objects.create(
                user=user,
                code=code
            )

        handle_send_email_code.delay(user.id, code)

        response_data = {
            "success": True,
            "message": "Confirmation code sent",
        }

        return Response(response_data, status=status.HTTP_201_CREATED)


class ResendVerificationEmailAPIView(GenericAPIView):
    """
    API view for resending verification emails to users
    """

    permission_classes = (AllowAny,)

    @required_fields(["email"])
    def get(self, request):
        email = request.query_params.get("email")
        logger.info(request.query_params)
        error_msg = "We have encountered an error resending the verification link"
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CustomAPIException(message=error_msg + f": Does Not Exist : {email}")
        except Exception as e:
            logger.exception(
                f"[EMAIL VERIFICATION] Error while resending an email"
                f" Error: {text_type(e)}"
            )
            raise CustomAPIException(message=error_msg + f" Error: {text_type(e)}")

        # check if the email is verified
        profile = user.profile
        if profile.email_verified:
            error_msg = "Email address is already verified"
            raise CustomAPIException(message=error_msg)

        # send the email now
        handle_send_email_verification.delay(user.id)

        response_data = {
            "message": "Verification email sent successfully!",
        }
        return Response(response_data, status=status.HTTP_200_OK)


class AccountDetailsAPIView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserAccountDetailsSerializer
    
    def get(self, request):
        try:
            # Get or create account details for the user
            account_details, created = UserAccountDetails.objects.get_or_create(
                user=request.user
            )
            serializer = self.serializer_class(account_details)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception(f"Error fetching account details: {str(e)}")
            return Response(
                {"error": "Failed to fetch account details"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UpdateAccountDetailsAPIView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UpdateAccountDetailsSerializer
    
    def patch(self, request):
        try:
            logger.info(f"=== UPDATE ACCOUNT DETAILS REQUEST ===")
            logger.info(f"User: {request.user.id} - {request.user.email}")
            logger.info(f"Request data: {request.data}")
            
            # Get or create account details for the user
            try:
                account_details = UserAccountDetails.objects.get(user=request.user)
                logger.info(f"Found existing account details: {account_details.id}")
            except UserAccountDetails.DoesNotExist:
                logger.info("Account details don't exist, creating new ones")
                account_details = UserAccountDetails.objects.create(user=request.user)
                logger.info(f"Created new account details: {account_details.id}")
            
            serializer = self.serializer_class(
                account_details, 
                data=request.data, 
                partial=True
            )
            
            if not serializer.is_valid():
                logger.error(f"Serializer validation errors: {serializer.errors}")
                return Response(
                    {"error": "Invalid data", "details": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            logger.info("Serializer is valid, saving data...")
            instance = serializer.save()
            logger.info(f"Successfully saved: {instance.__dict__}")
            
            return Response(
                {"message": "Account details updated successfully"},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.exception(f"CRITICAL ERROR updating account details: {str(e)}")
            return Response(
                {"error": "Failed to update account details", "details": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

