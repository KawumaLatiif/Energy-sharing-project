from django.urls import path
from loan.api.views import LoanApplicationView, LoanDetailView, LoanDisbursementView, LoanNotificationView, LoanRepaymentView, LoanStatsView, TariffListView, UserLoansView
from loan.api.momo_views import MoMoPaymentView, PaymentStatusView
from webhooks.api.views import LoanTokenVerificationView

urlpatterns = [
    path('apply/', LoanApplicationView.as_view(), name='loan-apply'),
    path('my-loans/', UserLoansView.as_view(), name='user-loans'),
    path('stats/', LoanStatsView.as_view(), name='loan-stats'),
    path('loan/<int:pk>/', LoanDetailView.as_view(), name='loan-detail'),
    path('repay/<int:loan_id>/', LoanRepaymentView.as_view(), name='loan-repay'),
    path('disburse/<int:loan_id>/', LoanDisbursementView.as_view(), name='loan-disburse'),
    path('notify/<int:loan_id>/', LoanNotificationView.as_view(), name='loan-notify'),
    path('verify-token/', LoanTokenVerificationView.as_view(), name='verify-token'),
    path('repay/momo/<int:loan_id>/', MoMoPaymentView.as_view(), name='loan-repay-momo'),
    path('payment-status/<str:external_id>/', PaymentStatusView.as_view(), name='payment-status'),
    # path('momo-callback/', MoMoPaymentCallbackView.as_view(), name='momo-callback'),
    path('tariffs/', TariffListView.as_view(), name='tariff-list')
]