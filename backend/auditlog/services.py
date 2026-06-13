from django.db import transaction

from .models import AuditEvent


def _authenticated_actor(request=None, actor=None):
    candidate = actor or getattr(request, "user", None)

    if candidate is not None and getattr(candidate, "is_authenticated", False):
        return candidate

    return None


def log_audit_event(
    *,
    action,
    entity_type,
    summary,
    entity_identifier="",
    request=None,
    actor=None,
):
    authenticated_actor = _authenticated_actor(request=request, actor=actor)
    actor_username = (
        authenticated_actor.get_username()
        if authenticated_actor is not None
        else ""
    )
    request_path = getattr(request, "path", "") if request is not None else ""

    return AuditEvent.objects.create(
        actor=authenticated_actor,
        actor_username=actor_username,
        action=action,
        entity_type=str(entity_type)[:100],
        entity_identifier=str(entity_identifier or "")[:100],
        summary=str(summary)[:500],
        request_path=str(request_path)[:500],
    )


class AuditedModelViewSetMixin:
    audit_entity_type = None

    def get_audit_entity_type(self, instance):
        return self.audit_entity_type or instance._meta.verbose_name.title()

    def get_audit_identifier(self, instance):
        return str(instance.pk)

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            log_audit_event(
                action=AuditEvent.Action.CREATE,
                entity_type=self.get_audit_entity_type(instance),
                entity_identifier=self.get_audit_identifier(instance),
                summary=f"Created {self.get_audit_entity_type(instance)} record.",
                request=self.request,
            )

    def perform_update(self, serializer):
        changed_fields = sorted(serializer.validated_data)

        with transaction.atomic():
            instance = serializer.save()
            field_summary = (
                ", ".join(changed_fields)
                if changed_fields
                else "no writable fields"
            )
            log_audit_event(
                action=AuditEvent.Action.UPDATE,
                entity_type=self.get_audit_entity_type(instance),
                entity_identifier=self.get_audit_identifier(instance),
                summary=(
                    f"Updated {self.get_audit_entity_type(instance)} record "
                    f"fields: {field_summary}."
                ),
                request=self.request,
            )

    def perform_destroy(self, instance):
        entity_type = self.get_audit_entity_type(instance)
        entity_identifier = self.get_audit_identifier(instance)

        with transaction.atomic():
            instance.delete()
            log_audit_event(
                action=AuditEvent.Action.DELETE,
                entity_type=entity_type,
                entity_identifier=entity_identifier,
                summary=f"Deleted {entity_type} record.",
                request=self.request,
            )
