import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

DEBUG = False

if os.getenv("DJANGO_SECRET_KEY") in {None, "", "unsafe-development-key"}:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production.")

if os.getenv("PATIENT_FIELD_KEY") in {None, "", PATIENT_FIELD_KEY_DEV_DEFAULT}:  # noqa: F405
    raise ImproperlyConfigured("PATIENT_FIELD_KEY must be set in production.")

if os.getenv("PATIENT_INDEX_KEY") in {None, "", PATIENT_INDEX_KEY_DEV_DEFAULT}:  # noqa: F405
    raise ImproperlyConfigured("PATIENT_INDEX_KEY must be set in production.")

# Fail fast rather than silently targeting the localhost dev database with the
# weak default credentials baked into base.py.
if not os.getenv("DATABASE_URL"):
    raise ImproperlyConfigured("DATABASE_URL must be set in production.")

# Require encrypted backups in production unless explicitly disabled. Backup
# creation is refused (with a clear message) when BACKUP_ENCRYPTION_KEY is unset.
BACKUP_ENCRYPTION_REQUIRED = env_bool("BACKUP_ENCRYPTION_REQUIRED", True)  # noqa: F405

# HTTPS hardening. Defaults are secure; each is env-overridable so the same
# production settings module can run behind different proxy/TLS topologies (for
# example, disabling the redirect when TLS is terminated upstream and the app is
# reached over the internal network).
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)  # noqa: F405
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", True)  # noqa: F405
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)  # noqa: F405
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)  # noqa: F405
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
