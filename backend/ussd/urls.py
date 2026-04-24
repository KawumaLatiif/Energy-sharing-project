from django.urls import path

from .views import ussd_entry


urlpatterns = [
    path("entry/", ussd_entry, name="ussd-entry"),
]
