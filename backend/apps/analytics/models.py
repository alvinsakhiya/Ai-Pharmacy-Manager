from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class ForecastRun(TimeStampedModel):
    class Status(models.TextChoices):
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    tenant_pharmacy_id_field = "pharmacy"

    pharmacy = models.ForeignKey(
        "tenancy.Pharmacy",
        on_delete=models.PROTECT,
        related_name="forecast_runs",
    )
    group = models.ForeignKey(
        "tenancy.Group",
        on_delete=models.PROTECT,
        related_name="forecast_runs",
    )
    horizon_days = models.PositiveIntegerField(default=30)
    lookback_days = models.PositiveIntegerField(default=90)
    model_version = models.CharField(max_length=32, default="baseline-1")
    is_demo = models.BooleanField(default=False)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="forecast_runs",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.COMPLETED,
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["pharmacy", "-created_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.pharmacy} forecast {self.created_at:%Y-%m-%d} "
            f"({self.model_version})"
        )


class ForecastItem(TimeStampedModel):
    run = models.ForeignKey(
        ForecastRun,
        on_delete=models.CASCADE,
        related_name="items",
    )
    stock_item = models.ForeignKey(
        "inventory.StockItem",
        on_delete=models.PROTECT,
        related_name="forecast_items",
    )
    catalogue_product = models.ForeignKey(
        "catalogue.CatalogueProduct",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="forecast_items",
    )
    medication_label = models.CharField(max_length=255)
    predicted_usage_units = models.PositiveIntegerField(default=0)
    predicted_usage_packs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    current_stock_units = models.PositiveIntegerField(default=0)
    current_stock_packs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    safety_stock_units = models.PositiveIntegerField(default=0)
    suggested_reorder_units = models.PositiveIntegerField(default=0)
    suggested_reorder_packs = models.PositiveIntegerField(null=True, blank=True)
    confidence = models.DecimalField(max_digits=3, decimal_places=2)
    explanation = models.TextField()
    history_points_count = models.PositiveIntegerField(default=0)
    window_days = models.PositiveIntegerField(default=90)

    class Meta:
        ordering = ["-suggested_reorder_units", "medication_label", "id"]
        indexes = [
            models.Index(fields=["run", "-suggested_reorder_units"]),
        ]

    def __str__(self) -> str:
        return f"{self.medication_label}: {self.suggested_reorder_units} units"


class TransferSuggestion(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        DISMISSED = "DISMISSED", "Dismissed"
        ACTIONED = "ACTIONED", "Actioned"

    tenant_group_id_field = "group"

    group = models.ForeignKey(
        "tenancy.Group",
        on_delete=models.PROTECT,
        related_name="transfer_suggestions",
    )
    catalogue_product = models.ForeignKey(
        "catalogue.CatalogueProduct",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="transfer_suggestions",
    )
    medication_label = models.CharField(max_length=255)
    source_pharmacy = models.ForeignKey(
        "tenancy.Pharmacy",
        on_delete=models.PROTECT,
        related_name="source_transfer_suggestions",
    )
    destination_pharmacy = models.ForeignKey(
        "tenancy.Pharmacy",
        on_delete=models.PROTECT,
        related_name="destination_transfer_suggestions",
    )
    source_stock_item = models.ForeignKey(
        "inventory.StockItem",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="source_transfer_suggestions",
    )
    destination_stock_item = models.ForeignKey(
        "inventory.StockItem",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="destination_transfer_suggestions",
    )
    suggested_quantity_units = models.PositiveIntegerField(default=0)
    suggested_quantity_packs = models.PositiveIntegerField(null=True, blank=True)
    current_source_stock_units = models.PositiveIntegerField(default=0)
    destination_recent_usage_units = models.PositiveIntegerField(default=0)
    dead_days = models.PositiveIntegerField(default=30)
    confidence = models.DecimalField(max_digits=3, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.OPEN,
    )
    model_version = models.CharField(max_length=32, default="transfer-baseline-1")
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transfer_suggestions",
    )

    class Meta:
        ordering = ["-created_at", "-suggested_quantity_units", "medication_label"]
        indexes = [
            models.Index(fields=["group", "status", "-created_at"]),
            models.Index(fields=["catalogue_product", "status"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.medication_label}: {self.source_pharmacy} to "
            f"{self.destination_pharmacy}"
        )
