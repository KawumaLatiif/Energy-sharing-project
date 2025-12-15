from django.urls import path

from .views import BuyUnitsView, CheckPaymentStatusView, MeterRegisterView
from .views import (
    SendUnitsView, 
    ReceiveUnitsView,
    TokenView
    )
from meter.api import views



urlpatterns = [
    path('send-units/', SendUnitsView.as_view(), name="send-units"),
    path('receive-units/', ReceiveUnitsView.as_view(), name="receive-units"),
    path('token/', TokenView.as_view(), name="token"),
    path('buy-units/', BuyUnitsView.as_view(), name="buy-units"),
    path('check-payment-status/', CheckPaymentStatusView.as_view(), name="check-payment-status"),
    path('register/', MeterRegisterView.as_view(), name='register-meter'),
    path('my-meter/', views.check_user_meter, name='check-user-meter'),
]

