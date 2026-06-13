from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q


class Supplier(models.Model):
    name = models.CharField(max_length=150, unique=True)
    contact_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    account_reference = models.CharField(max_length=100, blank=True)
    lead_time_days = models.PositiveSmallIntegerField(
        default=2,
        validators=[MaxValueValidator(365)],
    )
    notes = models.TextField(blank=True, max_length=2000)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Medication(models.Model):
    FORM_CHOICES = [
        ("Tablet", "Tablet"),
        ("Capsule", "Capsule"),
        ("Liquid", "Liquid"),
        ("Cream", "Cream"),
        ("Inhaler", "Inhaler"),
        ("Injection", "Injection"),
        ("Other", "Other"),
    ]

    name = models.CharField(max_length=150)
    strength = models.CharField(max_length=50)

    form = models.CharField(
        max_length=20,
        choices=FORM_CHOICES
    )

    manufacturer = models.CharField(
        max_length=100,
        blank=True
    )

    minimum_stock_level = models.PositiveIntegerField(default=0)

    reorder_threshold = models.PositiveIntegerField(default=0)

    target_weeks_of_cover = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        default=4,
        validators=[
            MinValueValidator(1),
            MaxValueValidator(52),
        ],
    )

    preferred_supplier = models.ForeignKey(
        Supplier,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="preferred_medications",
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} {self.strength} {self.form}"


class StockBatch(models.Model):
    medication = models.ForeignKey(
        Medication,
        on_delete=models.CASCADE,
        related_name="stock_batches"
    )

    batch_number = models.CharField(max_length=100)
    expiry_date = models.DateField()
    quantity = models.PositiveIntegerField(default=0)

    received_date = models.DateField()
    supplier = models.CharField(max_length=150, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["expiry_date"]
        unique_together = ("medication", "batch_number")

    def __str__(self):
        return f"{self.medication} | Batch: {self.batch_number} | Exp: {self.expiry_date}"


class ImmutableStockMovementQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError("Stock movements are immutable.")

    def delete(self):
        raise ValidationError("Stock movements cannot be deleted.")


class StockMovementManager(
    models.Manager.from_queryset(ImmutableStockMovementQuerySet)
):
    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("Stock movements are immutable.")


class StockMovement(models.Model):
    class MovementType(models.TextChoices):
        RECEIVED = "RECEIVED", "Received"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"
        PICKING_ALLOCATION = "PICKING_ALLOCATION", "Picking allocation"
        CORRECTION = "CORRECTION", "Correction"
        WASTE_QUARANTINE = "WASTE_QUARANTINE", "Waste / quarantine"

    stock_batch = models.ForeignKey(
        StockBatch,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stock_movements",
    )
    stock_batch_identifier = models.CharField(max_length=100, db_index=True)
    medication_identifier = models.CharField(max_length=100, blank=True)
    medication_name = models.CharField(max_length=250)
    batch_number = models.CharField(max_length=100)
    movement_type = models.CharField(
        max_length=30,
        choices=MovementType.choices,
        db_index=True,
    )
    quantity_change = models.IntegerField()
    quantity_before = models.PositiveIntegerField()
    quantity_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=300)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pharmacy_stock_movements",
    )
    actor_username = models.CharField(max_length=150, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = StockMovementManager()

    class Meta:
        ordering = ["-timestamp", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=~Q(quantity_change=0),
                name="stock_movement_non_zero_change",
            ),
            models.CheckConstraint(
                condition=Q(
                    quantity_after=F("quantity_before") + F("quantity_change")
                ),
                name="stock_movement_balances",
            ),
        ]
        indexes = [
            models.Index(
                fields=["stock_batch_identifier", "-timestamp"],
                name="stock_move_batch_time",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Stock movements are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Stock movements cannot be deleted.")

    def __str__(self):
        sign = "+" if self.quantity_change > 0 else ""
        return (
            f"{self.get_movement_type_display()} {self.batch_number} "
            f"({sign}{self.quantity_change})"
        )


class DraftPurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        REVIEWED = "REVIEWED", "Reviewed"
        ARCHIVED = "ARCHIVED", "Archived"

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="draft_purchase_orders",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    notes = models.TextField(blank=True, max_length=2000)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="draft_purchase_orders",
    )
    created_by_username = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["supplier", "status", "-created_at"],
                name="draft_po_supplier_status",
            ),
        ]

    @property
    def reference(self):
        return f"DRAFT-{self.pk:06d}" if self.pk else "DRAFT-PENDING"

    @property
    def total_units(self):
        prefetched_items = getattr(self, "_prefetched_objects_cache", {}).get(
            "items"
        )
        if prefetched_items is not None:
            return sum(item.quantity for item in prefetched_items)
        return self.items.aggregate(total=models.Sum("quantity"))["total"] or 0

    def __str__(self):
        return f"{self.reference} · {self.supplier}"


class DraftPurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(
        DraftPurchaseOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    medication = models.ForeignKey(
        Medication,
        on_delete=models.PROTECT,
        related_name="draft_purchase_order_items",
    )
    medication_name = models.CharField(max_length=250)
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
    )
    recommended_quantity = models.PositiveIntegerField()
    current_stock = models.PositiveIntegerField()
    target_stock = models.PositiveIntegerField()
    rationale = models.CharField(max_length=300)

    class Meta:
        ordering = ["medication_name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["purchase_order", "medication"],
                name="unique_draft_po_medication",
            ),
        ]

    def __str__(self):
        return (
            f"{self.purchase_order.reference} · "
            f"{self.medication_name} x {self.quantity}"
        )
