from django.urls import path
from .views import (
    AdminDashboardView,
    UserManagementView,
    MeterManagementView,
    ToggleUserStatusView,
    UserDetailView,
    AdminStatsView
)

urlpatterns = [
    path('dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('/test', AdminDashboardView.as_view(), name='test_dashboard'),
    path('users/', UserManagementView.as_view(), name='admin-users'),
    path('users/<int:user_id>/', UserDetailView.as_view(), name='user-detail'),
    path('meters/', MeterManagementView.as_view(), name='admin-meters'),
    path('stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('toggle-user-status/', ToggleUserStatusView.as_view(), name='toggle-user-status'),
]