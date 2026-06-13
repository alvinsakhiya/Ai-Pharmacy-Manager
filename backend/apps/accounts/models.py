"""Authentication & RBAC: a custom user with a single pharmacy role."""
from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    ADMINISTRATOR = "administrator", "Administrator"
    PHARMACIST = "pharmacist", "Pharmacist"
    DISPENSER = "dispenser", "Dispenser"


class User(AbstractUser):
    """Pharmacy staff member.

    Password hashing is handled by Django's PBKDF2 (set_password); RBAC is driven
    by the `role` field and enforced in apps.core.permissions.
    """

    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.DISPENSER
    )
    job_title = models.CharField(max_length=120, blank=True)
    gphc_number = models.CharField(
        "Professional registration no.", max_length=20, blank=True,
        help_text="Simulated professional registration number (pseudo data).",
    )

    @property
    def display_role(self) -> str:
        return self.get_role_display()

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"
