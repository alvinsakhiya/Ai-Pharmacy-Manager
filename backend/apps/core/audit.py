"""Helper for writing audit entries from anywhere in the codebase."""
from .middleware import get_current_user
from .models import AuditLog


def record(action: str, entity: str, *, entity_id="", summary="", detail=None, actor=None):
    """Create an AuditLog entry, snapshotting the actor's label."""
    actor = actor or get_current_user()
    actor_label = ""
    if actor and getattr(actor, "is_authenticated", False):
        actor_label = actor.get_full_name() or actor.username
    return AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        actor_label=actor_label or "system",
        action=action,
        entity=entity,
        entity_id=str(entity_id),
        summary=summary[:255],
        detail=detail or {},
    )
