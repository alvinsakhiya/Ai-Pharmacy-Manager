from typing import Any

from django.contrib.auth.models import AnonymousUser

from apps.tenancy.policy import get_active_membership

from .models import AuditAction, AuditEvent


def _is_authenticated_actor(actor: Any) -> bool:
    is_authenticated = getattr(actor, "is_authenticated", False)
    if callable(is_authenticated):
        return bool(is_authenticated())
    return bool(is_authenticated)


def record(
    *,
    action,
    actor=None,
    group=None,
    pharmacy=None,
    target=None,
    metadata=None,
    request=None,
    ip_address=None,
    user_agent=None,
) -> AuditEvent:
    stored_action = action.value if isinstance(action, AuditAction) else action

    stored_actor = None
    actor_email = ""
    actor_role = ""

    if (
        actor is not None
        and not isinstance(actor, AnonymousUser)
        and _is_authenticated_actor(actor)
        and getattr(actor, "is_active", False)
    ):
        stored_actor = actor
        actor_email = getattr(actor, "email", "") or ""
        membership = get_active_membership(actor)
        if membership is not None:
            actor_role = membership.role
            if group is None:
                group = membership.group
            if pharmacy is None:
                pharmacy = membership.pharmacy

    target_type = ""
    target_id = ""
    if target is not None:
        target_type = target.__class__.__name__
        target_id = str(target.pk)

    if request is not None:
        if ip_address is None:
            ip_address = request.META.get("REMOTE_ADDR")
        if user_agent is None:
            user_agent = request.META.get("HTTP_USER_AGENT", "")

    return AuditEvent.objects.create(
        actor=stored_actor,
        actor_email=actor_email,
        actor_role=actor_role,
        action=stored_action,
        group=group,
        pharmacy=pharmacy,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata or {},
        ip_address=ip_address,
        user_agent=user_agent or "",
    )
