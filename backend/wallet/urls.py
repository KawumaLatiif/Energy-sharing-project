from django.urls import path
from .views import (
    WalletBalanceView,
    TransactionHistoryView,
    CreateWalletView,
)

urlpatterns = [
    path('balance/', WalletBalanceView.as_view(), name='wallet-balance'),
    path('transactions/', TransactionHistoryView.as_view(), name='transaction-history'),
    path('create/', CreateWalletView.as_view(), name='create-wallet'),
]