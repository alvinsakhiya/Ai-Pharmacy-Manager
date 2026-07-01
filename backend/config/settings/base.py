import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BASE_DIR.parent

load_dotenv(ROOT_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    # A present-but-empty value (e.g. `FLAG=`) falls back to the default rather
    # than reading as False, so a blank env var cannot silently flip a safe
    # default (e.g. BACKUP_ENCRYPTION_REQUIRED) off.
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [
        item.strip() for item in os.getenv(name, default).split(",") if item.strip()
    ]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-development-key")
# Dev/test-only fallback Fernet key for prototype patient field encryption.
# Set PATIENT_FIELD_KEY outside local development; this fallback is not secret.
PATIENT_FIELD_KEY_DEV_DEFAULT = "YaKhc3E0z_nLejfE-AK0J6LQJS6RCfoaL8lctbICjwM="
PATIENT_FIELD_KEY = os.getenv("PATIENT_FIELD_KEY", PATIENT_FIELD_KEY_DEV_DEFAULT)
# DEV/TEST ONLY - not a secret; production MUST set PATIENT_INDEX_KEY.
PATIENT_INDEX_KEY_DEV_DEFAULT = "dev-only-patient-index-key-not-secret"
PATIENT_INDEX_KEY = os.getenv("PATIENT_INDEX_KEY", PATIENT_INDEX_KEY_DEV_DEFAULT)
DEBUG = env_bool("DJANGO_DEBUG")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "apps.core",
    "apps.accounts",
    "apps.tenancy",
    "apps.audit",
    "apps.catalogue",
    "apps.inventory",
    "apps.patients",
    "apps.blister",
    "apps.analytics",
    "apps.reports",
    "apps.notifications",
    "apps.reviews",
    "apps.backups",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default="postgresql://pharmacy:pharmacy@localhost:5432/pharmacy",
        conn_max_age=60,
    )
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
        )
    },
    {"NAME": ("django.contrib.auth.password_validation.MinimumLengthValidator")},
    {"NAME": ("django.contrib.auth.password_validation.CommonPasswordValidator")},
    {"NAME": ("django.contrib.auth.password_validation.NumericPasswordValidator")},
]

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Europe/London"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
# `or` (not a getenv default) so a present-but-empty BACKUP_ROOT= does not
# resolve to Path(".") / the process working directory.
BACKUP_ROOT = Path(os.getenv("BACKUP_ROOT") or str(MEDIA_ROOT / "backups"))
# Base64 32-byte key for AES-256-GCM backup archive encryption. Blank in local
# development allows unencrypted dev backups; generate one with
# `python manage.py generate_backup_key`. Never commit a real key.
BACKUP_ENCRYPTION_KEY = os.getenv("BACKUP_ENCRYPTION_KEY", "")
# When True, backup creation is refused unless BACKUP_ENCRYPTION_KEY is set.
BACKUP_ENCRYPTION_REQUIRED = env_bool("BACKUP_ENCRYPTION_REQUIRED")
# Reported in backup manifests and available to documentation views.
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "login": os.getenv("LOGIN_THROTTLE_RATE", "10/min"),
    },
}

CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE")
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE")
