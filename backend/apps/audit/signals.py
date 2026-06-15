import logging

from django.contrib.auth.signals import (
    user_logged_in,
    user_logged_out,
    user_login_failed,
)
from django.dispatch import receiver

from .models import AuditAction
from .services import record

logger = logging.getLogger(__name__)


@receiver(user_logged_in)
def audit_login(sender, request, user, **kwargs) -> None:
    try:
        record(action=AuditAction.LOGIN, actor=user, request=request)
    except Exception:
        logger.exception("Failed to record login audit event.")


@receiver(user_logged_out)
def audit_logout(sender, request, user, **kwargs) -> None:
    try:
        record(action=AuditAction.LOGOUT, actor=user, request=request)
    except Exception:
        logger.exception("Failed to record logout audit event.")


@receiver(user_login_failed)
def audit_login_failed(sender, credentials, request, **kwargs) -> None:
    try:
        attempted_email = credentials.get("username") or credentials.get("email") or ""
        record(
            action=AuditAction.LOGIN_FAILED,
            actor=None,
            request=request,
            metadata={"email": attempted_email},
        )
    except Exception:
        logger.exception("Failed to record failed-login audit event.")
