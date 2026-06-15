from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    is_active = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def soft_delete(self) -> None:
        self.is_active = False
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_active", "deleted_at"])


class TenantScopedQuerySet(models.QuerySet):
    def for_user(self, user):
        raise NotImplementedError("Tenant scoping is implemented in Phase 1 Task 4.")


TenantScopedManager = models.Manager.from_queryset(TenantScopedQuerySet)
