from django.urls import path
from .views import ShareUnitsView, TransferUnitsView

urlpatterns = [
    path('share-units/', ShareUnitsView.as_view(), name="share-units"),
    path('transfer-units/', TransferUnitsView.as_view(), name="transfer-units"),
]