from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.core.models import TenantScopedManager, TimeStampedModel


class Group(TimeStampedModel):
    tenant_group_id_field = "id"

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    def __str__(self) -> str:
        return self.name


class Pharmacy(TimeStampedModel):
    tenant_pharmacy_id_field = "id"

    group = models.ForeignKey(
        Group,
        on_delete=models.PROTECT,
        related_name="pharmacies",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    address = models.TextField(blank=True)
    postcode = models.CharField(max_length=16, blank=True)
    is_active = models.BooleanField(default=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["group", "code"],
                name="unique_pharmacy_code_per_group",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class Role(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    SUPERINTENDENT = "SUPERINTENDENT", "Superintendent"
    STOCK_EMPLOYEE = "STOCK_EMPLOYEE", "Stock employee"
    PHARMACIST = "PHARMACIST", "Pharmacist"
    DISPENSER = "DISPENSER", "Dispenser"


class Membership(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=32, choices=Role.choices)
    group = models.ForeignKey(
        Group,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    pharmacy = models.ForeignKey(
        Pharmacy,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    pharmacies = models.ManyToManyField(
        Pharmacy,
        blank=True,
        related_name="stock_memberships",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(role=Role.ADMIN, group__isnull=True, pharmacy__isnull=True)
                    | Q(
                        role=Role.SUPERINTENDENT,
                        group__isnull=False,
                        pharmacy__isnull=True,
                    )
                    | Q(
                        role=Role.STOCK_EMPLOYEE,
                        group__isnull=False,
                        pharmacy__isnull=True,
                    )
                    | Q(
                        role=Role.PHARMACIST,
                        group__isnull=True,
                        pharmacy__isnull=False,
                    )
                    | Q(
                        role=Role.DISPENSER,
                        group__isnull=True,
                        pharmacy__isnull=False,
                    )
                ),
                name="membership_scope_matches_role",
            ),
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(is_active=True),
                name="unique_active_membership_per_user",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} – {self.role}"

    def clean(self) -> None:
        super().clean()

        errors = {}

        if self.role == Role.ADMIN:
            if self.group_id is not None:
                errors["group"] = "Admin memberships must not be scoped to a group."
            if self.pharmacy_id is not None:
                errors["pharmacy"] = (
                    "Admin memberships must not be scoped to a pharmacy."
                )
        elif self.role in {Role.SUPERINTENDENT, Role.STOCK_EMPLOYEE}:
            if self.group_id is None:
                errors["group"] = (
                    f"{self.get_role_display()} memberships require a group."
                )
            if self.pharmacy_id is not None:
                errors["pharmacy"] = (
                    f"{self.get_role_display()} memberships must not be scoped "
                    "to a pharmacy."
                )
        elif self.role in {Role.PHARMACIST, Role.DISPENSER}:
            if self.group_id is not None:
                errors["group"] = (
                    f"{self.get_role_display()} memberships must not be scoped "
                    "to a group."
                )
            if self.pharmacy_id is None:
                errors["pharmacy"] = (
                    f"{self.get_role_display()} memberships require a pharmacy."
                )

        if errors:
            raise ValidationError(errors)
