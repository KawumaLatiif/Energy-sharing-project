from django.urls import path
from .views import BuyUnitsView





urlpatterns = [
    path('buy-units/', BuyUnitsView.as_view(), name="buy-units")
]