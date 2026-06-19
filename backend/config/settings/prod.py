import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

DEBUG = False

if os.getenv("DJANGO_SECRET_KEY") in {None, "", "unsafe-development-key"}:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production.")

if os.getenv("PATIENT_FIELD_KEY") in {None, "", PATIENT_FIELD_KEY_DEV_DEFAULT}:  # noqa: F405
    raise ImproperlyConfigured("PATIENT_FIELD_KEY must be set in production.")

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_HSTS_SECONDS = 31536000
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
