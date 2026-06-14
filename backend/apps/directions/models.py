"""Reusable, staff-approved label directions.

These phrases speed up data entry but never bypass staff review. They contain no
patient data and do not provide clinical decision support.
"""
from django.db import models

from apps.core.models import TimeStampedModel


class TrustedDirection(TimeStampedModel):
    class Category(models.TextChoices):
        DOSE = "dose", "Dose"
        TIMING = "timing", "Timing"
        ROUTE = "route", "Route"
        QUALIFIER = "qualifier", "Qualifier"
        GENERAL = "general", "General"

    code = models.CharField(max_length=16, unique=True, db_index=True)
    text = models.CharField(max_length=180, db_index=True)
    category = models.CharField(
        max_length=16, choices=Category.choices, default=Category.GENERAL
    )
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveSmallIntegerField(default=100)

    class Meta:
        ordering = ["sort_order", "code"]
        indexes = [models.Index(fields=["is_active", "category", "sort_order"])]

    def __str__(self):
        return f"{self.code} · {self.text}"
