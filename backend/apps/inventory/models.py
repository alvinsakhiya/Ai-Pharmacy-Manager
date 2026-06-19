from django.db import models

from apps.core.models import TenantScopedManager, TimeStampedModel


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
