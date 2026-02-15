# import logging
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from django.contrib.auth import get_user_model
# from meter.models import Meter
# from accounts.models import Profile, UserAccountDetails
# from datetime import datetime, timedelta
# from django.db.models import Q
# from loan.models import LoanApplication

# logger = logging.getLogger(__name__)
# User = get_user_model()

# class AdminPermissionMixin:
#     """Mixin to check admin permissions"""
    
#     def check_admin_permission(self, request):
#         if not request.user.is_authenticated:
#             return False, Response(
#                 {"error": "Authentication required"},
#                 status=status.HTTP_401_UNAUTHORIZED
#             )
        
#         if not request.user.user_role == User.ADMIN:
#             return False, Response(
#                 {"error": "Admin access required"},
#                 status=status.HTTP_403_FORBIDDEN
#             )
        
#         return True, None



# class AdminAccountView(APIView, AdminPermissionMixin):
#     permission_classes = [IsAuthenticated]
    
#     def get(self, request):
#         # Check admin permission
#         is_admin, error_response = self.check_admin_permission(request)
#         if not is_admin:
#             return error_response
        
#         try:
#             # Get query parameters
#             # search = request.GET.get('search', '')
#             # status_filter = request.GET.get('status', 'all')
#             # page = int(request.GET.get('page', 1))
#             # limit = int(request.GET.get('limit', 20))
#             # offset = (page - 1) * limit
            
#             # Build query
#             users_query = User.objects.filter(user_role=User.ADMIN)
            
#             # Apply search filter
#             # if search:
#             #     users_query = users_query.filter(
#             #         Q(email__icontains=search) |
#             #         Q(first_name__icontains=search) |
#             #         Q(last_name__icontains=search) |
#             #         Q(phone_number__icontains=search)
#             #     )
            
#             # Apply status filter
#             # if status_filter == 'active':
#             #     users_query = users_query.filter(account_is_active=True)
#             # elif status_filter == 'inactive':
#             #     users_query = users_query.filter(account_is_active=False)
#             # elif status_filter == 'verified':
#             #     users_query = users_query.filter(profile__email_verified=True)
#             # elif status_filter == 'unverified':
#             #     users_query = users_query.filter(profile__email_verified=False)
            
#             # Get total count for pagination
#             # total_count = users_query.count()
            
#             # Apply pagination
#             users = users_query.select_related('profile').order_by('-create_date')[offset:offset + limit]
            
#             user_list = []
#             for user in users:
#                 # try:
#                 #     meter = Meter.objects.get(user=user)
#                 #     has_meter = True
#                 #     meter_info = {
#                 #         "meter_no": meter.meter_no,
#                 #         "static_ip": meter.static_ip,
#                 #         "units": meter.units
#                 #     }
#                 # except Meter.DoesNotExist:
#                 #     has_meter = False
#                 #     meter_info = None
                
#                 # Get account details if exists
#                 # try:
#                 #     account_details = UserAccountDetails.objects.get(user=user)
#                 #     account_info = {
#                 #         "account_number": account_details.account_number,
#                 #         "address": account_details.address,
#                 #         "energy_preference": account_details.energy_preference,
#                 #         "payment_method": account_details.payment_method
#                 #     }
#                 # except UserAccountDetails.DoesNotExist:
#                 #     account_info = None
                
#                 user_list.append({
#                     "id": user.id,
#                     "email": user.email,
#                     "first_name": user.first_name,
#                     "last_name": user.last_name,
#                     "phone_number": str(user.phone_number),
#                     # "email_verified": user.profile.email_verified,
#                     # "account_active": user.account_is_active,
#                     # "has_meter": has_meter,
#                     # "meter_info": meter_info,
#                     "account_info": account_info,
#                     "created_at": user.create_date.isoformat(),
#                     "last_login": user.last_login.isoformat() if user.last_login else None,
#                     # "profile_complete": user.has_complete_profile
#                 })
            
#             return Response({
#                 "success": True,
#                 "users": user_list,
#                 # "pagination": {
#                 #     "page": page,
#                 #     "limit": limit,
#                 #     "total": total_count,
#                 #     "pages": (total_count + limit - 1) // limit
#                 # },
#                 # "filters": {
#                 #     "search": search,
#                 #     "status": status_filter
#                 # }
#             })
            
#         except Exception as e:
#             logger.error(f"Admin management error: {str(e)}")
#             return Response(
#                 {"error": "Failed to fetch users"},
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             )

import logging
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
import json
from datetime import datetime, timedelta
from meter.models import Meter
from accounts.models import Profile, UserAccountDetails
from loan.models import LoanApplication
from .models import AdminNotificationSettings, AdminSession, AdminActivityLog
from .serializers import (
    AdminProfileSerializer, 
    AdminPasswordChangeSerializer,
    AdminNotificationSettingsSerializer
)
from loan.models import LoanTier, ElectricityTariff
from loan.api.serializers import LoanTierSerializer, ElectricityTariffSerializer  

logger = logging.getLogger(__name__)
User = get_user_model()

class AdminPermissionMixin:
    """Mixin to check admin permissions"""
    
    def check_admin_permission(self, request):
        if not request.user.is_authenticated:
            return False, Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not request.user.user_role == User.ADMIN:
            return False, Response(
                {"error": "Admin access required"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return True, None
    
    def log_admin_activity(self, user, action, details=None, request=None):
        """Log admin activity"""
        try:
            AdminActivityLog.objects.create(
                user=user,
                action=action,
                details=details or {},
                ip_address=request.META.get('REMOTE_ADDR', '') if request else '',
                user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
            )
        except Exception as e:
            logger.error(f"Failed to log admin activity: {str(e)}")


class LoanTierDetailView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        try:
            tier = LoanTier.objects.get(pk=pk)
            serializer = LoanTierSerializer(tier)
            return Response(serializer.data)
        except LoanTier.DoesNotExist:
            return Response({"error": "Loan tier not found"}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        try:
            tier = LoanTier.objects.get(pk=pk)
            serializer = LoanTierSerializer(tier, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except LoanTier.DoesNotExist:
            return Response({"error": "Loan tier not found"}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        try:
            tier = LoanTier.objects.get(pk=pk)
            tier.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except LoanTier.DoesNotExist:
            return Response({"error": "Loan tier not found"}, status=status.HTTP_404_NOT_FOUND)


class TariffsView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        tariffs = ElectricityTariff.objects.filter(is_active=True)
        serializer = ElectricityTariffSerializer(tariffs, many=True)
        return Response(serializer.data)

    def post(self, request):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        serializer = ElectricityTariffSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TariffDetailView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        try:
            tariff = ElectricityTariff.objects.get(pk=pk)
            serializer = ElectricityTariffSerializer(tariff)
            return Response(serializer.data)
        except ElectricityTariff.DoesNotExist:
            return Response({"error": "Tariff not found"}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        try:
            tariff = ElectricityTariff.objects.get(pk=pk)
            serializer = ElectricityTariffSerializer(tariff, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except ElectricityTariff.DoesNotExist:
            return Response({"error": "Tariff not found"}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        try:
            tariff = ElectricityTariff.objects.get(pk=pk)
            tariff.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ElectricityTariff.DoesNotExist:
            return Response({"error": "Tariff not found"}, status=status.HTTP_404_NOT_FOUND)


class LoanTiersView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        tiers = LoanTier.objects.filter(is_active=True).order_by('min_score')
        serializer = LoanTierSerializer(tiers, many=True)
        return Response(serializer.data)

    def post(self, request):
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        serializer = LoanTierSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminAccountView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    
    def get(self, request):
        """Get current admin's account details"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            profile = getattr(user, 'profile', None)
            
            # Get notification settings
            notification_settings = getattr(user, 'notification_settings', None)
            
            # Get active sessions
            active_sessions = AdminSession.objects.filter(
                user=user,
                is_active=True,
                expires_at__gt=timezone.now()
            ).order_by('-login_time')
            
            # Get recent activities
            recent_activities = AdminActivityLog.objects.filter(
                user=user
            ).order_by('-created_at')[:10]
            
            response_data = {
                "success": True,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "phone_number": str(user.phone_number) if user.phone_number else None,
                    "gender": user.gender,
                    "role": "Super Administrator" if user.is_superuser else "Administrator",
                    "account_active": user.account_is_active,
                    "is_superuser": user.is_superuser,
                    "email_verified": profile.email_verified if profile else False,
                    "created_at": user.create_date.isoformat() if user.create_date else None,
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                },
                "notification_settings": {
                    "email_notifications": notification_settings.email_notifications if notification_settings else True,
                    "sms_notifications": notification_settings.sms_notifications if notification_settings else False,
                    "loan_approvals": notification_settings.loan_approvals if notification_settings else True,
                    "user_registrations": notification_settings.user_registrations if notification_settings else True,
                    "system_alerts": notification_settings.system_alerts if notification_settings else True,
                    "weekly_reports": notification_settings.weekly_reports if notification_settings else False,
                    "report_schedule": notification_settings.report_schedule if notification_settings else 'weekly'
                },
                "sessions": [
                    {
                        "id": session.id,
                        "ip_address": session.ip_address,
                        "user_agent": session.user_agent[:100] + "..." if len(session.user_agent) > 100 else session.user_agent,
                        "login_time": session.login_time.isoformat(),
                        "expires_at": session.expires_at.isoformat(),
                        "is_current": session.session_key == request.session.session_key
                    }
                    for session in active_sessions
                ],
                "recent_activities": [
                    {
                        "action": activity.action,
                        "details": activity.details,
                        "created_at": activity.created_at.isoformat()
                    }
                    for activity in recent_activities
                ]
            }
            
            return Response(response_data)
            
        except Exception as e:
            logger.error(f"Admin account get error: {str(e)}")
            return Response(
                {"error": "Failed to fetch admin account details"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def put(self, request):
        """Update admin profile"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            data = request.data.copy()
            
            # Validate and update user data
            serializer = AdminProfileSerializer(user, data=data, partial=True)
            if not serializer.is_valid():
                return Response(
                    {"error": "Validation failed", "details": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            with transaction.atomic():
                serializer.save()
                
                # Update profile if it exists
                if hasattr(user, 'profile'):
                    profile = user.profile
                    # You can update profile-specific fields here if needed
                    profile.save()
            
            # Log activity
            self.log_admin_activity(
                user=user,
                action="Updated profile",
                details={"updated_fields": list(data.keys())},
                request=request
            )
            
            return Response({
                "success": True,
                "message": "Profile updated successfully",
                "user": serializer.data
            })
            
        except ValidationError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Admin profile update error: {str(e)}")
            return Response(
                {"error": "Failed to update profile"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminPasswordChangeView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Change admin password"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            serializer = AdminPasswordChangeSerializer(data=request.data)
            
            if not serializer.is_valid():
                return Response(
                    {"error": "Validation failed", "details": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            data = serializer.validated_data
            
            # Verify current password
            if not check_password(data['current_password'], user.password):
                return Response(
                    {"error": "Current password is incorrect"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if new password is same as current
            if check_password(data['new_password'], user.password):
                return Response(
                    {"error": "New password must be different from current password"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update password
            user.password = make_password(data['new_password'])
            user.save()
            
            # Log activity
            self.log_admin_activity(
                user=user,
                action="Changed password",
                request=request
            )
            
            return Response({
                "success": True,
                "message": "Password changed successfully"
            })
            
        except Exception as e:
            logger.error(f"Admin password change error: {str(e)}")
            return Response(
                {"error": "Failed to change password"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminNotificationSettingsView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get notification settings"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            settings, created = AdminNotificationSettings.objects.get_or_create(
                user=user,
                defaults={
                    'email_notifications': True,
                    'sms_notifications': False,
                    'loan_approvals': True,
                    'user_registrations': True,
                    'system_alerts': True,
                    'weekly_reports': False,
                    'report_schedule': 'weekly'
                }
            )
            
            serializer = AdminNotificationSettingsSerializer(settings)
            return Response({
                "success": True,
                "settings": serializer.data
            })
            
        except Exception as e:
            logger.error(f"Get notification settings error: {str(e)}")
            return Response(
                {"error": "Failed to fetch notification settings"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def put(self, request):
        """Update notification settings"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            settings, created = AdminNotificationSettings.objects.get_or_create(
                user=user,
                defaults={
                    'email_notifications': True,
                    'sms_notifications': False,
                    'loan_approvals': True,
                    'user_registrations': True,
                    'system_alerts': True,
                    'weekly_reports': False,
                    'report_schedule': 'weekly'
                }
            )
            
            serializer = AdminNotificationSettingsSerializer(
                settings, 
                data=request.data, 
                partial=True
            )
            
            if not serializer.is_valid():
                return Response(
                    {"error": "Validation failed", "details": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer.save()
            
            # Log activity
            self.log_admin_activity(
                user=user,
                action="Updated notification settings",
                details=serializer.data,
                request=request
            )
            
            return Response({
                "success": True,
                "message": "Notification settings updated successfully",
                "settings": serializer.data
            })
            
        except Exception as e:
            logger.error(f"Update notification settings error: {str(e)}")
            return Response(
                {"error": "Failed to update notification settings"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminSessionManagementView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all sessions"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            sessions = AdminSession.objects.filter(user=user).order_by('-login_time')
            
            session_list = []
            for session in sessions:
                session_list.append({
                    "id": session.id,
                    "session_key": session.session_key[:10] + "..." if len(session.session_key) > 10 else session.session_key,
                    "ip_address": session.ip_address,
                    "user_agent": session.user_agent[:100] + "..." if len(session.user_agent) > 100 else session.user_agent,
                    "is_active": session.is_active and session.expires_at > timezone.now(),
                    "login_time": session.login_time.isoformat(),
                    "logout_time": session.logout_time.isoformat() if session.logout_time else None,
                    "expires_at": session.expires_at.isoformat(),
                    "is_current": session.session_key == request.session.session_key
                })
            
            return Response({
                "success": True,
                "sessions": session_list,
                "total_sessions": len(session_list),
                "active_sessions": len([s for s in session_list if s['is_active']])
            })
            
        except Exception as e:
            logger.error(f"Get sessions error: {str(e)}")
            return Response(
                {"error": "Failed to fetch sessions"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """Terminate a session"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            session_id = request.data.get('session_id')
            
            if not session_id:
                return Response(
                    {"error": "Session ID is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Don't allow terminating current session from this endpoint
            # (Use logout endpoint instead)
            session = AdminSession.objects.get(
                id=session_id,
                user=user
            )
            
            if session.session_key == request.session.session_key:
                return Response(
                    {"error": "Cannot terminate current session from here"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Terminate session
            session.is_active = False
            session.logout_time = timezone.now()
            session.save()
            
            # Log activity
            self.log_admin_activity(
                user=user,
                action="Terminated session",
                details={"session_id": session_id},
                request=request
            )
            
            return Response({
                "success": True,
                "message": "Session terminated successfully"
            })
            
        except AdminSession.DoesNotExist:
            return Response(
                {"error": "Session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Terminate session error: {str(e)}")
            return Response(
                {"error": "Failed to terminate session"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request):
        """Terminate all other sessions"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            current_session_key = request.session.session_key
            
            # Terminate all other sessions
            terminated = AdminSession.objects.filter(
                user=user,
                is_active=True
            ).exclude(
                session_key=current_session_key
            ).update(
                is_active=False,
                logout_time=timezone.now()
            )
            
            # Log activity
            self.log_admin_activity(
                user=user,
                action="Terminated all other sessions",
                details={"sessions_terminated": terminated},
                request=request
            )
            
            return Response({
                "success": True,
                "message": f"Terminated {terminated} other session(s)",
                "terminated_count": terminated
            })
            
        except Exception as e:
            logger.error(f"Terminate all sessions error: {str(e)}")
            return Response(
                {"error": "Failed to terminate sessions"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminActivityLogView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get activity logs"""
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = request.user
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 50))
            offset = (page - 1) * limit
            
            activities = AdminActivityLog.objects.filter(user=user).order_by('-created_at')
            
            total_count = activities.count()
            activities = activities[offset:offset + limit]
            
            activity_list = []
            for activity in activities:
                activity_list.append({
                    "id": activity.id,
                    "action": activity.action,
                    "details": activity.details,
                    "ip_address": activity.ip_address,
                    "user_agent": activity.user_agent[:50] + "..." if len(activity.user_agent) > 50 else activity.user_agent,
                    "created_at": activity.created_at.isoformat()
                })
            
            return Response({
                "success": True,
                "activities": activity_list,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            })
            
        except Exception as e:
            logger.error(f"Get activity logs error: {str(e)}")
            return Response(
                {"error": "Failed to fetch activity logs"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminDashboardView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            # Calculate time ranges
            today = datetime.now().date()
            last_week = today - timedelta(days=7)
            last_month = today - timedelta(days=30)
            
            # Get dashboard stats
            total_users = User.objects.filter(user_role=User.CLIENT).count()
            total_admins = User.objects.filter(user_role=User.ADMIN).count()
            total_meters = Meter.objects.count()
            active_meters = Meter.objects.filter(units__gt=0).count()
            
            # New users
            new_users_today = User.objects.filter(
                user_role=User.CLIENT,
                create_date__date=today
            ).count()
            
            new_users_week = User.objects.filter(
                user_role=User.CLIENT,
                create_date__date__gte=last_week
            ).count()
            
            # Users with verified email
            verified_users = Profile.objects.filter(email_verified=True).count()
            
            # Users with meters
            users_with_meters = User.objects.filter(
                user_role=User.CLIENT,
                devices__isnull=False
            ).distinct().count()
            
            # TODO: Implement loan statistics when loan models are available
            # For now, return placeholder values
            total_loans = 0
            active_loans = 0
            pending_loans = 0
            outstanding_balance = 0
            
            # Recent users (last 10)
            recent_users = User.objects.filter(
                user_role=User.CLIENT
            ).select_related('profile').order_by('-create_date')[:10]
            
            recent_users_list = [
                {
                    "id": user.id,
                    "email": user.email,
                    "name": f"{user.first_name} {user.last_name}",
                    "phone": str(user.phone_number),
                    "email_verified": user.profile.email_verified,
                    "joined": user.create_date.strftime("%Y-%m-%d %H:%M"),
                    "has_meter": hasattr(user, 'devices') and user.devices.exists()
                }
                for user in recent_users
            ]
            
            return Response({
                "success": True,
                # Flat structure for easier frontend consumption
                "total_users": total_users,
                "total_admins": total_admins,
                "total_meters": total_meters,
                "active_meters": active_meters,
                "verified_users": verified_users,
                "users_with_meters": users_with_meters,
                "new_users_today": new_users_today,
                "new_users_week": new_users_week,
                "total_loans": total_loans,
                "active_loans": active_loans,
                "pending_loans": pending_loans,
                "outstanding_balance": outstanding_balance,
                "recent_registrations": new_users_week,
                "verification_rate": round((verified_users / total_users * 100) if total_users > 0 else 0, 1),
                "recent_users": recent_users_list,
                "timestamp": datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Admin dashboard error: {str(e)}")
            return Response(
                {"error": "Failed to fetch dashboard data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserManagementView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            # Get query parameters
            search = request.GET.get('search', '')
            status_filter = request.GET.get('status', 'all')
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 20))
            offset = (page - 1) * limit
            
            # Build query
            users_query = User.objects.filter(user_role=User.CLIENT)
            
            # Apply search filter
            if search:
                users_query = users_query.filter(
                    Q(email__icontains=search) |
                    Q(first_name__icontains=search) |
                    Q(last_name__icontains=search) |
                    Q(phone_number__icontains=search)
                )
            
            # Apply status filter
            if status_filter == 'active':
                users_query = users_query.filter(account_is_active=True)
            elif status_filter == 'inactive':
                users_query = users_query.filter(account_is_active=False)
            elif status_filter == 'verified':
                users_query = users_query.filter(profile__email_verified=True)
            elif status_filter == 'unverified':
                users_query = users_query.filter(profile__email_verified=False)
            
            # Get total count for pagination
            total_count = users_query.count()
            
            # Apply pagination
            users = users_query.select_related('profile').order_by('-create_date')[offset:offset + limit]
            
            user_list = []
            for user in users:
                try:
                    meter = Meter.objects.get(user=user)
                    has_meter = True
                    meter_info = {
                        "meter_no": meter.meter_no,
                        "static_ip": meter.static_ip,
                        "units": meter.units
                    }
                except Meter.DoesNotExist:
                    has_meter = False
                    meter_info = None
                
                # Get account details if exists
                try:
                    account_details = UserAccountDetails.objects.get(user=user)
                    account_info = {
                        "account_number": account_details.account_number,
                        "address": account_details.address,
                        "energy_preference": account_details.energy_preference,
                        "payment_method": account_details.payment_method
                    }
                except UserAccountDetails.DoesNotExist:
                    account_info = None
                
                user_list.append({
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "phone_number": str(user.phone_number),
                    "email_verified": user.profile.email_verified,
                    "account_active": user.account_is_active,
                    "has_meter": has_meter,
                    "meter_info": meter_info,
                    "account_info": account_info,
                    "created_at": user.create_date.isoformat(),
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                    "profile_complete": user.has_complete_profile
                })
            
            return Response({
                "success": True,
                "users": user_list,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                },
                "filters": {
                    "search": search,
                    "status": status_filter
                }
            })
            
        except Exception as e:
            logger.error(f"User management error: {str(e)}")
            return Response(
                {"error": "Failed to fetch users"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserDetailView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, user_id):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            user = User.objects.select_related('profile').get(
                id=user_id, 
                user_role=User.CLIENT
            )
            
            # Get meter info
            try:
                meter = Meter.objects.get(user=user)
                meter_info = {
                    "id": meter.id,
                    "meter_no": meter.meter_no,
                    "static_ip": meter.static_ip,
                    "units": meter.units,
                    "created_at": meter.create_date.isoformat(),
                    "updated_at": meter.modify_date.isoformat()
                }
            except Meter.DoesNotExist:
                meter_info = None
            
            # Get account details
            try:
                account_details = UserAccountDetails.objects.get(user=user)
                account_info = {
                    "account_number": account_details.account_number,
                    "address": account_details.address,
                    "energy_preference": account_details.energy_preference,
                    "payment_method": account_details.payment_method,
                    "created_at": account_details.create_date.isoformat()
                }
            except UserAccountDetails.DoesNotExist:
                account_info = None
            
            # Get profile assessment data
            profile_data = {
                "monthly_expenditure": user.monthly_expenditure,
                "purchase_frequency": user.purchase_frequency,
                "payment_consistency": user.payment_consistency,
                "disconnection_history": user.disconnection_history,
                "meter_sharing": user.meter_sharing,
                "monthly_income": user.monthly_income,
                "income_stability": user.income_stability,
                "consumption_level": user.consumption_level,
                "profile_complete": user.has_complete_profile
            }
            
            return Response({
                "success": True,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "phone_number": str(user.phone_number),
                    "gender": user.gender,
                    "email_verified": user.profile.email_verified,
                    "account_active": user.account_is_active,
                    "created_at": user.create_date.isoformat(),
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                    "profile_data": profile_data,
                    "meter": meter_info,
                    "account_details": account_info
                }
            })
            
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"User detail error: {str(e)}")
            return Response(
                {"error": "Failed to fetch user details"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MeterManagementView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            # Get query parameters
            search = request.GET.get('search', '')
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 20))
            offset = (page - 1) * limit
            
            # Build query
            meters_query = Meter.objects.all()
            
            # Apply search filter
            if search:
                meters_query = meters_query.filter(
                    Q(meter_no__icontains=search) |
                    Q(static_ip__icontains=search) |
                    Q(user__email__icontains=search) |
                    Q(user__first_name__icontains=search) |
                    Q(user__last_name__icontains=search)
                )
            
            # Get total count
            total_count = meters_query.count()
            
            # Apply pagination
            meters = meters_query.select_related('user').order_by('-create_date')[offset:offset + limit]
            
            meter_list = []
            for meter in meters:
                meter_list.append({
                    "meter_id": meter.id,
                    "meter_no": meter.meter_no,
                    "static_ip": meter.static_ip,
                    "units": meter.units,
                    "user": {
                        "id": meter.user.id,
                        "email": meter.user.email,
                        "name": f"{meter.user.first_name} {meter.user.last_name}",
                        "phone": str(meter.user.phone_number),
                        "account_active": meter.user.account_is_active
                    },
                    "created_at": meter.create_date.isoformat(),
                    "last_updated": meter.modify_date.isoformat()
                })
            
            return Response({
                "success": True,
                "meters": meter_list,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }
            })
            
        except Exception as e:
            logger.error(f"Meter management error: {str(e)}")
            return Response(
                {"error": "Failed to fetch meters"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LoanManagementView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response

        try:
            search = request.GET.get('search', '')
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 20))
            offset = (page - 1) * limit

            loans_query = LoanApplication.objects.all()
            
            # Apply search filter
            if search:
                loans_query = loans_query.filter(
                    Q(loan_id__icontains=search) |
                    Q(user__icontains=search) |
                    Q(interest_rate__icontains=search) |
                    Q(status__icontains=search) |
                    Q(credit_score__icontains=search)
                )
            
            # Get total count
            total_count = loans_query.count()
            
            loans = loans_query.select_related('user').order_by('-created_at')[offset:offset + limit]
           

            loan_list = []
            for loan in loans:
                loan_list.append({
                    "loan_id": loan.id,
                    "status": loan.status,
                    "amount_requested": loan.amount_requested,
                    "amount_approved": loan.amount_approved,
                    "user": {
                        "id": loan.user.id,
                        "email": loan.user.email,
                        "name": f"{loan.user.first_name} {loan.user.last_name}",
                        "phone": str(loan.user.phone_number),
                        "account_active": loan.user.account_is_active
                    },
                    "loan_tier": loan.loan_tier,
                    "last_updated": loan.created_at.isoformat()
                })
            return Response({
                "success": True,
                "loans": loan_list,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total_count,
                    "pages": (total_count + limit - 1) // limit
                }                
            })

        except Exception as e:
            logger.error(f"Loan management error: {str(e)}")
            return Response(
                {"error": "Failed to fetch loans"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class LoanDetailView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, loan_id):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            loan = LoanApplication.objects.select_related('user', 'tariff').get(id=loan_id)
            
            # Get repayments
            repayments = loan.repayments.all().order_by('-payment_date')
            
            # Get disbursement if exists
            disbursement = getattr(loan, 'disbursement', None)
            
            # Serialize data
            loan_data = {
                "id": loan.id,
                "loan_id": loan.loan_id,
                "user": {
                    "id": loan.user.id,
                    "email": loan.user.email,
                    "first_name": loan.user.first_name,
                    "last_name": loan.user.last_name,
                    "phone_number": str(loan.user.phone_number),
                    "account_active": loan.user.account_is_active,
                },
                "purpose": loan.purpose,
                "amount_requested": float(loan.amount_requested),
                "amount_approved": float(loan.amount_approved) if loan.amount_approved else None,
                "tenure_months": loan.tenure_months,
                "interest_rate": float(loan.interest_rate),
                "status": loan.status,
                "credit_score": loan.credit_score,
                "loan_tier": loan.loan_tier,
                "rejection_reason": loan.rejection_reason,
                "user_notified": loan.user_notified,
                "created_at": loan.created_at.isoformat(),
                "due_date": loan.due_date.isoformat() if loan.due_date else None,
                "total_amount_due": float(loan.total_amount_due),
                "amount_paid": float(loan.amount_paid),
                "outstanding_balance": float(loan.outstanding_balance),
                "repayments": [
                    {
                        "id": r.id,
                        "amount_paid": float(r.amount_paid),
                        "payment_date": r.payment_date.isoformat(),
                        "units_paid": float(r.units_paid),
                        "is_on_time": r.is_on_time,
                        "payment_reference": r.payment_reference
                    }
                    for r in repayments
                ]
            }
            
            # Add tariff info if exists
            if loan.tariff:
                loan_data["tariff"] = {
                    "id": loan.tariff.id,
                    "tariff_code": loan.tariff.tariff_code,
                    "tariff_name": loan.tariff.tariff_name,
                    "tariff_type": loan.tariff.tariff_type
                }
            
            # Add disbursement info if exists
            if disbursement:
                loan_data["disbursement"] = {
                    "id": disbursement.id,
                    "token": disbursement.token,
                    "units_disbursed": float(disbursement.units_disbursed),
                    "disbursement_date": disbursement.disbursement_date.isoformat(),
                    "token_expiry": disbursement.token_expiry.isoformat(),
                    "meter": {
                        "id": disbursement.meter.id,
                        "meter_no": disbursement.meter.meter_no
                    }
                }
            
            # Calculate units and cost breakdown if approved/disbursed
            if loan.amount_approved and loan.tariff:
                loan_data["units_calculated"] = loan.calculate_units_from_amount()
                loan_data["cost_breakdown"] = loan.get_cost_breakdown()
            
            return Response({
                "success": True,
                "loan": loan_data
            })
            
        except LoanApplication.DoesNotExist:
            return Response(
                {"error": "Loan not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Loan detail error: {str(e)}")
            return Response(
                {"error": "Failed to fetch loan details"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ToggleUserStatusView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {"error": "User ID is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id, user_role=User.CLIENT)
            user.account_is_active = not user.account_is_active
            user.save()
            
            action = "activated" if user.account_is_active else "deactivated"
            
            logger.info(f"Admin {request.user.id} {action} user {user.id}")
            
            return Response({
                "success": True,
                "message": f"User account {action} successfully",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "account_active": user.account_is_active
                }
            })
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Toggle user status error: {str(e)}")
            return Response(
                {"error": "Failed to update user status"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminStatsView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            # Time ranges
            today = datetime.now().date()
            last_week = today - timedelta(days=7)
            last_month = today - timedelta(days=30)
            last_year = today - timedelta(days=365)
            
            # User registration stats
            daily_registrations = []
            for i in range(7):
                date = today - timedelta(days=i)
                count = User.objects.filter(
                    user_role=User.CLIENT,
                    create_date__date=date
                ).count()
                daily_registrations.append({
                    "date": date.isoformat(),
                    "count": count
                })
            
            daily_registrations.reverse()
            
            # Meter registration stats
            meter_daily = []
            for i in range(7):
                date = today - timedelta(days=i)
                count = Meter.objects.filter(
                    create_date__date=date
                ).count()
                meter_daily.append({
                    "date": date.isoformat(),
                    "count": count
                })
            
            meter_daily.reverse()
            
            # User status distribution
            status_distribution = {
                "active": User.objects.filter(account_is_active=True, user_role=User.CLIENT).count(),
                "inactive": User.objects.filter(account_is_active=False, user_role=User.CLIENT).count(),
                "verified": Profile.objects.filter(email_verified=True).count(),
                "unverified": Profile.objects.filter(email_verified=False).count()
            }
            
            # Meter units distribution
            meters_with_units = Meter.objects.filter(units__gt=0).count()
            meters_without_units = Meter.objects.filter(units=0).count()
            
            return Response({
                "success": True,
                "stats": {
                    "user_registrations": {
                        "daily": daily_registrations,
                        "weekly_total": User.objects.filter(
                            user_role=User.CLIENT,
                            create_date__date__gte=last_week
                        ).count(),
                        "monthly_total": User.objects.filter(
                            user_role=User.CLIENT,
                            create_date__date__gte=last_month
                        ).count()
                    },
                    "meter_registrations": {
                        "daily": meter_daily,
                        "total": Meter.objects.count()
                    },
                    "user_status": status_distribution,
                    "meter_status": {
                        "with_units": meters_with_units,
                        "without_units": meters_without_units,
                        "active_ratio": round((meters_with_units / Meter.objects.count() * 100) if Meter.objects.count() > 0 else 0, 1)
                    }
                }
            })
            
        except Exception as e:
            logger.error(f"Admin stats error: {str(e)}")
            return Response(
                {"error": "Failed to fetch statistics"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
