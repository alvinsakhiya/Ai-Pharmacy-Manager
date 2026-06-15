import pytest
from django.contrib.auth.signals import (
    user_logged_in,
    user_logged_out,
    user_login_failed,
)
from django.test import RequestFactory

from apps.accounts.models import User

from .models import AuditAction, AuditEvent


@pytest.fixture
def user() -> User:
    return User.objects.create_user("signal-user@example.com", "test-password")


@pytest.fixture
def audit_request():
    return RequestFactory().post(
        "/login/",
        REMOTE_ADDR="127.0.0.1",
        HTTP_USER_AGENT="Signal test browser",
    )


@pytest.mark.django_db
def test_user_logged_in_signal_creates_login_event(user, audit_request):
    user_logged_in.send(sender=User, request=audit_request, user=user)

    event = AuditEvent.objects.get()
    assert event.action == AuditAction.LOGIN
    assert event.actor == user


@pytest.mark.django_db
def test_user_logged_out_signal_creates_logout_event(user, audit_request):
    user_logged_out.send(sender=User, request=audit_request, user=user)

    event = AuditEvent.objects.get()
    assert event.action == AuditAction.LOGOUT
    assert event.actor == user


@pytest.mark.django_db
def test_user_login_failed_signal_creates_failed_login_event(audit_request):
    user_login_failed.send(
        sender=User,
        credentials={"username": "failed@example.com", "password": "secret"},
        request=audit_request,
    )

    event = AuditEvent.objects.get()
    assert event.action == AuditAction.LOGIN_FAILED
    assert event.actor is None
    assert event.metadata == {"email": "failed@example.com"}


@pytest.mark.django_db
def test_failed_login_does_not_store_password(audit_request):
    password = "secret"
    user_login_failed.send(
        sender=User,
        credentials={"email": "failed@example.com", "password": password},
        request=audit_request,
    )

    event = AuditEvent.objects.get()
    stored_values = [
        str(event.metadata),
        event.actor_email,
        event.actor_role,
        event.target_type,
        event.target_id,
        event.user_agent,
    ]

    assert all(password not in value for value in stored_values)
    assert "password" not in str(event.metadata)
