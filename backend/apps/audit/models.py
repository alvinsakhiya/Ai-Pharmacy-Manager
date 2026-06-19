from django.conf import settings
from django.db import models


class AuditAction(models.TextChoices):
    LOGIN = "LOGIN", "Login"
    LOGOUT = "LOGOUT", "Logout"
    LOGIN_FAILED = "LOGIN_FAILED", "Login failed"

    USER_CREATED = "USER_CREATED", "User created"
    USER_DEACTIVATED = "USER_DEACTIVATED", "User deactivated"
    USER_DELETED = "USER_DELETED", "User deleted"
    PASSWORD_CHANGED = "PASSWORD_CHANGED", "Password changed"
    PASSWORD_RESET = "PASSWORD_RESET", "Password reset"
    ROLE_ASSIGNED = "ROLE_ASSIGNED", "Role assigned"

    GROUP_CREATED = "GROUP_CREATED", "Group created"
    GROUP_UPDATED = "GROUP_UPDATED", "Group updated"
    PHARMACY_CREATED = "PHARMACY_CREATED", "Pharmacy created"
    PHARMACY_UPDATED = "PHARMACY_UPDATED", "Pharmacy updated"

    MEDICATION_CREATED = "MEDICATION_CREATED", "Medication created"
    MEDICATION_UPDATED = "MEDICATION_UPDATED", "Medication updated"

    PATIENT_CREATED = "PATIENT_CREATED", "Patient created"
    PATIENT_UPDATED = "PATIENT_UPDATED", "Patient updated"
    PATIENT_DEACTIVATED = "PATIENT_DEACTIVATED", "Patient deactivated"
    PATIENT_NOTE_ADDED = "PATIENT_NOTE_ADDED", "Patient note added"

    BLISTER_MEDICATION_ADDED = "BLISTER_MEDICATION_ADDED", "Blister medication added"
    BLISTER_MEDICATION_UPDATED = (
        "BLISTER_MEDICATION_UPDATED",
        "Blister medication updated",
    )
    BLISTER_MEDICATION_DISCONTINUED = (
        "BLISTER_MEDICATION_DISCONTINUED",
        "Blister medication discontinued",
    )

    STOCK_RECEIVED = "STOCK_RECEIVED", "Stock received"
    STOCK_ADJUSTED = "STOCK_ADJUSTED", "Stock adjusted"
    STOCK_COUNT_RECONCILED = "STOCK_COUNT_RECONCILED", "Stock count reconciled"
    STOCK_TRANSFERRED = "STOCK_TRANSFERRED", "Stock transferred"


class AuditEvent(models.Model):
    """Append-only audit event with application-level write protection.

    Normal instance updates through ``save()`` and instance deletion through
    ``delete()`` are blocked after initial insert. This does not block
    QuerySet.update(), QuerySet.delete(), bulk operations, or raw SQL. True
    immutability will need database-level controls, triggers, or permissions
    in a later hardening phase.
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )
    actor_email = models.CharField(max_length=254, blank=True)
    actor_role = models.CharField(max_length=32, blank=True)

    action = models.CharField(max_length=64, choices=AuditAction.choices)

    group = models.ForeignKey(
        "tenancy.Group",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    pharmacy = models.ForeignKey(
        "tenancy.Pharmacy",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)

    metadata = models.JSONField(default=dict, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["actor"]),
            models.Index(fields=["group", "created_at"]),
            models.Index(fields=["pharmacy", "created_at"]),
        ]

    def save(self, *args, **kwargs) -> None:
        if self.pk is not None:
            raise ValueError("Audit events are append-only and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> tuple[int, dict[str, int]]:
        raise ValueError("Audit events are append-only and cannot be deleted.")
