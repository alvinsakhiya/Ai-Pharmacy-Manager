"""Regression tests for the production-settings hardening (Phase 1).

These lock in the security posture so it cannot silently drift: the server
entrypoints must default to the production settings module, the security headers
and session lifetime must be set, and the production settings must refuse to boot
without the required secrets.
"""

import subprocess
import sys
from pathlib import Path
from typing import Any, cast

from django.conf import settings

BACKEND_DIR = Path(settings.BASE_DIR)


def _read(rel: str) -> str:
    return (BACKEND_DIR / rel).read_text(encoding="utf-8")


def test_wsgi_and_asgi_default_to_prod_settings():
    # The WSGI/ASGI entrypoints (used by gunicorn/uvicorn) must fail safe by
    # defaulting to production, not development.
    for rel in ("config/wsgi.py", "config/asgi.py"):
        source = _read(rel)
        assert 'setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")' in source
        assert "config.settings.dev" not in source


def test_manage_py_still_defaults_to_dev():
    # Local management commands stay on dev settings for convenience.
    assert 'setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")' in _read(
        "manage.py"
    )


def test_env_helpers_treat_empty_as_default(monkeypatch):
    from config.settings.base import env_bool, env_int

    monkeypatch.setenv("AIPM_T_INT", "")
    assert env_int("AIPM_T_INT", 7) == 7
    monkeypatch.setenv("AIPM_T_INT", "42")
    assert env_int("AIPM_T_INT", 7) == 42

    monkeypatch.setenv("AIPM_T_BOOL", "")
    assert env_bool("AIPM_T_BOOL", True) is True
    monkeypatch.setenv("AIPM_T_BOOL", "false")
    assert env_bool("AIPM_T_BOOL", True) is False


def test_security_headers_and_session_lifetime():
    assert settings.SECURE_CONTENT_TYPE_NOSNIFF is True
    assert settings.X_FRAME_OPTIONS == "DENY"
    assert settings.SECURE_REFERRER_POLICY == "same-origin"
    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"
    # Default is 12 hours unless SESSION_COOKIE_AGE is overridden.
    assert settings.SESSION_COOKIE_AGE == 12 * 60 * 60


def test_logging_captures_security_events():
    logging_config = cast("dict[str, Any]", settings.LOGGING)
    assert "django.security" in logging_config["loggers"]
    assert logging_config["handlers"]["console"]["class"] == "logging.StreamHandler"


def _prod_setup(extra_env, code="import django; django.setup()"):
    env = {
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        "DJANGO_SECRET_KEY": "real-prod-secret-key-not-the-dev-default",
        "PATIENT_FIELD_KEY": "cGxhY2Vob2xkZXItcHJvZC10ZXN0LWtleS12YWx1ZT0=",
        "PATIENT_INDEX_KEY": "prod-index-key",
        "DATABASE_URL": "postgresql://pharmacy:pharmacy@localhost:5432/pharmacy",
    }
    env.update(extra_env)
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
    )


def test_prod_boots_with_all_secrets_present():
    result = _prod_setup({})
    assert result.returncode == 0, result.stderr


def test_prod_refuses_without_database_url():
    # Empty (present-but-blank) value is not overridden by load_dotenv, so the
    # guard fires deterministically regardless of any local .env.
    result = _prod_setup({"DATABASE_URL": ""})
    assert result.returncode != 0
    assert "DATABASE_URL must be set in production" in result.stderr


def test_prod_refuses_dev_secret_key():
    result = _prod_setup({"DJANGO_SECRET_KEY": "unsafe-development-key"})
    assert result.returncode != 0
    assert "DJANGO_SECRET_KEY must be set in production" in result.stderr


def test_prod_allows_loopback_for_container_healthcheck():
    # The Docker healthcheck probes http://127.0.0.1:8000/api/health/ from
    # inside the container; loopback must stay allowed even when the operator
    # sets DJANGO_ALLOWED_HOSTS to the public domain only.
    result = _prod_setup(
        {"DJANGO_ALLOWED_HOSTS": "demo.example.org"},
        code=(
            "import django; django.setup(); "
            "from django.conf import settings; print(settings.ALLOWED_HOSTS)"
        ),
    )
    assert result.returncode == 0, result.stderr
    assert "demo.example.org" in result.stdout
    assert "127.0.0.1" in result.stdout
