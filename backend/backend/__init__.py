import os
from celery import Celery

# Set default Django settings for Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')  # Adjust if your settings file is named differently

# Create Celery app instance
celery_app = Celery('backend')  # Name matches your project

# Load task modules from all registered Django apps
celery_app.config_from_object('django.conf:settings', namespace='CELERY')
celery_app.autodiscover_tasks()

# Optional: Silence warnings in dev
celery_app.conf.worker_hijack_root_logger = False