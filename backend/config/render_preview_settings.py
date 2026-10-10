"""Isolated Render demo settings; production config.settings is unchanged."""
import os
import re

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403

# Fail before database operations if someone accidentally supplies a production URL.
if os.getenv('DATABASE_URL') != 'sqlite:////var/data/freshcast-demo.sqlite3':
    raise ImproperlyConfigured('Render preview requires its isolated /var/data SQLite database.')

hostname = os.getenv('RENDER_EXTERNAL_HOSTNAME', '')
if not re.fullmatch(r'[a-z0-9][a-z0-9.-]*\.onrender\.com', hostname):
    raise ImproperlyConfigured('Render preview requires RENDER_EXTERNAL_HOSTNAME from Render.')

DEBUG = False
ALLOWED_HOSTS = ['localhost', '127.0.0.1', hostname]
CSRF_TRUSTED_ORIGINS = ['https://' + hostname]
CORS_ALLOWED_ORIGINS = ['https://' + hostname]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
