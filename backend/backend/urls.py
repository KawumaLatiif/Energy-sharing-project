"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

def home(request):
    return HttpResponse("Welcome to the Metering API! Visit /api/v1/ for API endpoints or /admin/ for the admin interface.")

urlpatterns = [
    path('', home, name='home'),
    path('admin/', admin.site.urls),
    path('api/v1/', include(("backend.api1", "api1"), namespace="api1")),
    # Add direct loan URLs for testing
    # path('api/v1/', include('loan.urls')),  # Direct include
]

urlpatterns += static(
    settings.STATIC_URL, document_root=settings.STATIC_ROOT
)

urlpatterns += static(
    settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
)
admin.site.site_header = "Metering System"
admin.site.site_title = "Metering Admin Portal"
admin.site.index_title = "Welcome to Metering Portal"