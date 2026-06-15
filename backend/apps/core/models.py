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
        from apps.tenancy.policy import resolve_scope

        scope = resolve_scope(user)
        if scope.is_global:
            return self

        tenant_pharmacy_id_field = getattr(
            self.model,
            "tenant_pharmacy_id_field",
            None,
        )
        tenant_group_id_field = getattr(
            self.model,
            "tenant_group_id_field",
            None,
        )

        if tenant_pharmacy_id_field:
            return self.filter(
                **{f"{tenant_pharmacy_id_field}__in": scope.pharmacy_ids}
            )
        if tenant_group_id_field:
            return self.filter(**{f"{tenant_group_id_field}__in": scope.group_ids})

        return self.none()


TenantScopedManager = models.Manager.from_queryset(TenantScopedQuerySet)
TenantScopedManager.use_in_migrations = False
