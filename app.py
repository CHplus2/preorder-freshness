"""Vercel WSGI entrypoint: frontend and API share one origin."""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
