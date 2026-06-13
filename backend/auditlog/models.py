from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class ImmutableAuditQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError("Audit events are immutable.")

    def delete(self):
        raise ValidationError("Audit events cannot be deleted.")


class AuditEventManager(models.Manager.from_queryset(ImmutableAuditQuerySet)):
    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("Audit events are immutable.")


class AuditEvent(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Created"
        UPDATE = "UPDATE", "Updated"
        DELETE = "DELETE", "Deleted"
        ACCESS = "ACCESS", "Accessed"
        GENERATE = "GENERATE", "Generated"
        LOGIN = "LOGIN", "Logged in"
        LOGOUT = "LOGOUT", "Logged out"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pharmacy_audit_events",
    )
    actor_username = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=20, choices=Action.choices, db_index=True)
    entity_type = models.CharField(max_length=100, db_index=True)
    entity_identifier = models.CharField(max_length=100, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    summary = models.CharField(max_length=500)
    request_path = models.CharField(max_length=500, blank=True)

    objects = AuditEventManager()

    class Meta:
        ordering = ["-timestamp", "-id"]
        indexes = [
            models.Index(
                fields=["entity_type", "entity_identifier"],
                name="audit_entity_lookup",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Audit events are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Audit events cannot be deleted.")

    def __str__(self):
        target = self.entity_type
        if self.entity_identifier:
            target = f"{target} #{self.entity_identifier}"
        return f"{self.get_action_display()} {target}"
