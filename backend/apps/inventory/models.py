from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.models import TenantScopedManager, TimeStampedModel


class MovementType(models.TextChoices):
    RECEIPT = "RECEIPT", "Receipt"
    ADJUSTMENT = "ADJUSTMENT", "Adjustment"
    COUNT_CORRECTION = "COUNT_CORRECTION", "Count correction"
    TRANSFER_IN = "TRANSFER_IN", "Transfer in"
    TRANSFER_OUT = "TRANSFER_OUT", "Transfer out"
    BLISTER_DEDUCTION = "BLISTER_DEDUCTION", "Blister deduction"


class StockItem(TimeStampedModel):
    tenant_pharmacy_id_field = "pharmacy"

    pharmacy = models.ForeignKey(
        "tenancy.Pharmacy",
        on_delete=models.PROTECT,
        related_name="stock_items",
    )
    medication = models.ForeignKey(
        "catalogue.Medication",
        on_delete=models.PROTECT,
        related_name="stock_items",
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    reorder_level = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["medication__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["pharmacy", "medication"],
                name="unique_stock_item_per_pharmacy",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.pharmacy} - {self.medication}"


class StockBatch(TimeStampedModel):
    tenant_pharmacy_id_field = "stock_item__pharmacy"

    stock_item = models.ForeignKey(
        StockItem,
        on_delete=models.PROTECT,
        related_name="batches",
    )
    batch_number = models.CharField(max_length=64)
    expiry_date = models.DateField()
    quantity = models.PositiveIntegerField(default=0)
    quantity_received = models.PositiveIntegerField(default=0)
    received_at = models.DateField()
    is_active = models.BooleanField(default=True)

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["expiry_date", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["stock_item", "batch_number"],
                name="unique_batch_number_per_stock_item",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.stock_item} - {self.batch_number}"


class StockMovement(TimeStampedModel):
    tenant_pharmacy_id_field = "stock_item__pharmacy"

    stock_item = models.ForeignKey(
        StockItem,
        on_delete=models.PROTECT,
        related_name="movements",
    )
    batch = models.ForeignKey(
        StockBatch,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movements",
    )
    movement_type = models.CharField(max_length=32, choices=MovementType.choices)
    quantity_delta = models.IntegerField()
    balance_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=128, blank=True, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="stock_movements",
    )

    objects = models.Manager()
    scoped = TenantScopedManager()

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["stock_item", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~Q(quantity_delta=0),
                name="stock_movement_nonzero_delta",
            ),
        ]

    def save(self, *args, **kwargs) -> None:
        if self.pk is not None:
            raise ValueError("Stock movements are append-only and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> tuple[int, dict[str, int]]:
        raise ValueError("Stock movements are append-only and cannot be deleted.")
