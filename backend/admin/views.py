import logging
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from meter.models import Meter
from accounts.models import Profile, UserAccountDetails
from datetime import datetime, timedelta
from django.db.models import Q
from loan.models import LoanApplication

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

class AdminAccountView(APIView, AdminPermissionMixin):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Check admin permission
        is_admin, error_response = self.check_admin_permission(request)
        if not is_admin:
            return error_response
        
        try:
            # Get query parameters
            # search = request.GET.get('search', '')
            # status_filter = request.GET.get('status', 'all')
            # page = int(request.GET.get('page', 1))
            # limit = int(request.GET.get('limit', 20))
            # offset = (page - 1) * limit
            
            # Build query
            users_query = User.objects.filter(user_role=User.ADMIN)
            
            # Apply search filter
            # if search:
            #     users_query = users_query.filter(
            #         Q(email__icontains=search) |
            #         Q(first_name__icontains=search) |
            #         Q(last_name__icontains=search) |
            #         Q(phone_number__icontains=search)
            #     )
            
            # Apply status filter
            # if status_filter == 'active':
            #     users_query = users_query.filter(account_is_active=True)
            # elif status_filter == 'inactive':
            #     users_query = users_query.filter(account_is_active=False)
            # elif status_filter == 'verified':
            #     users_query = users_query.filter(profile__email_verified=True)
            # elif status_filter == 'unverified':
            #     users_query = users_query.filter(profile__email_verified=False)
            
            # Get total count for pagination
            # total_count = users_query.count()
            
            # Apply pagination
            users = users_query.select_related('profile').order_by('-create_date')[offset:offset + limit]
            
            user_list = []
            for user in users:
                # try:
                #     meter = Meter.objects.get(user=user)
                #     has_meter = True
                #     meter_info = {
                #         "meter_no": meter.meter_no,
                #         "static_ip": meter.static_ip,
                #         "units": meter.units
                #     }
                # except Meter.DoesNotExist:
                #     has_meter = False
                #     meter_info = None
                
                # Get account details if exists
                # try:
                #     account_details = UserAccountDetails.objects.get(user=user)
                #     account_info = {
                #         "account_number": account_details.account_number,
                #         "address": account_details.address,
                #         "energy_preference": account_details.energy_preference,
                #         "payment_method": account_details.payment_method
                #     }
                # except UserAccountDetails.DoesNotExist:
                #     account_info = None
                
                user_list.append({
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "phone_number": str(user.phone_number),
                    # "email_verified": user.profile.email_verified,
                    # "account_active": user.account_is_active,
                    # "has_meter": has_meter,
                    # "meter_info": meter_info,
                    "account_info": account_info,
                    "created_at": user.create_date.isoformat(),
                    "last_login": user.last_login.isoformat() if user.last_login else None,
                    # "profile_complete": user.has_complete_profile
                })
            
            return Response({
                "success": True,
                "users": user_list,
                # "pagination": {
                #     "page": page,
                #     "limit": limit,
                #     "total": total_count,
                #     "pages": (total_count + limit - 1) // limit
                # },
                # "filters": {
                #     "search": search,
                #     "status": status_filter
                # }
            })
            
        except Exception as e:
            logger.error(f"Admin management error: {str(e)}")
            return Response(
                {"error": "Failed to fetch users"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


