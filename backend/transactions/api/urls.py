from django.urls import path
from .views import BuyUnitsView, TransactionHistoryView





urlpatterns = [
    path('buy-units/', BuyUnitsView.as_view(), name="buy-units"),
    path('history/', TransactionHistoryView.as_view(), name="transaction-history"),
]