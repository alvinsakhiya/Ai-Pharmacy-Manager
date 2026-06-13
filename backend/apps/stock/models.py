"""Inventory domain: medicines, suppliers, manufacturers, batches (FEFO),
stock movements, and historical usage used by the forecasting engine.

Quantities are tracked at the unit (tablet/capsule/ml) level on each batch, so
FEFO allocation and expiry visibility are exact rather than pack-approximate.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.db import models, transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce

from apps.core.models import TimeStampedModel


class Supplier(TimeStampedModel):
    name = models.CharField(max_length=160, unique=True)
    account_ref = models.CharField(max_length=40, blank=True)
    lead_time_days = models.PositiveIntegerField(default=2)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Manufacturer(TimeStampedModel):
    name = models.CharField(max_length=160, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class MedicineQuerySet(models.QuerySet):
    def with_stock_totals(self):
        stock_value = ExpressionWrapper(
            F("batches__quantity_on_hand") * F("batches__unit_cost"),
            output_field=DecimalField(max_digits=18, decimal_places=4),
        )
        return self.annotate(
            _quantity_on_hand=Coalesce(Sum("batches__quantity_on_hand"), 0),
            _stock_value=Coalesce(
                Sum(stock_value),
                Value(Decimal("0")),
                output_field=DecimalField(max_digits=18, decimal_places=4),
            ),
        )


class Medicine(TimeStampedModel):
    class Form(models.TextChoices):
        TABLET = "tablet", "Tablet"
        CAPSULE = "capsule", "Capsule"
        LIQUID = "liquid", "Liquid"
        INHALER = "inhaler", "Inhaler"
        SACHET = "sachet", "Sachet"
        OTHER = "other", "Other"

    name = models.CharField(max_length=160)
    strength = models.CharField(max_length=40, blank=True)        # e.g. "5mg"
    form = models.CharField(max_length=20, choices=Form.choices, default=Form.TABLET)
    pack_size = models.PositiveIntegerField(default=28)            # units per pack
    unit = models.CharField(max_length=20, default="tablet")
    manufacturer = models.ForeignKey(Manufacturer, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="medicines")
    default_supplier = models.ForeignKey(Supplier, null=True, blank=True,
                                         on_delete=models.SET_NULL, related_name="medicines")
    reorder_level = models.PositiveIntegerField(default=200)       # in units
    reorder_quantity = models.PositiveIntegerField(default=500)
    unit_cost = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    is_active = models.BooleanField(default=True)
    objects = MedicineQuerySet.as_manager()

    class Meta:
        ordering = ["name", "strength"]
        unique_together = [("name", "strength", "form")]

    @property
    def label(self):
        return f"{self.name} {self.strength} {self.get_form_display().lower()}".strip()

    # --- Inventory aggregates ------------------------------------------------
    def quantity_on_hand(self) -> int:
        if hasattr(self, "_quantity_on_hand"):
            return self._quantity_on_hand
        return self.batches.aggregate(t=Sum("quantity_on_hand"))["t"] or 0

    def stock_value(self):
        if hasattr(self, "_stock_value"):
            return self._stock_value
        total = 0
        for b in self.batches.all():
            total += b.quantity_on_hand * b.unit_cost
        return total

    def is_low_stock(self) -> bool:
        return self.quantity_on_hand() <= self.reorder_level

    def __str__(self):
        return self.label


class StockBatch(TimeStampedModel):
    """A physical lot of a medicine with its own expiry — the FEFO unit."""

    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name="batches")
    supplier = models.ForeignKey(Supplier, null=True, blank=True, on_delete=models.SET_NULL)
    batch_number = models.CharField(max_length=40)
    expiry_date = models.DateField(db_index=True)
    quantity_received = models.PositiveIntegerField(default=0)
    quantity_on_hand = models.PositiveIntegerField(default=0)
    location = models.CharField(max_length=20, blank=True)   # e.g. "A3"
    received_date = models.DateField(default=date.today)
    unit_cost = models.DecimalField(max_digits=8, decimal_places=4, default=0)

    class Meta:
        ordering = ["expiry_date"]   # FEFO ordering by default
        indexes = [models.Index(fields=["medicine", "expiry_date"])]

    @property
    def days_to_expiry(self) -> int:
        return (self.expiry_date - date.today()).days

    @property
    def is_expired(self) -> bool:
        return self.expiry_date < date.today()

    @property
    def expiry_band(self) -> str:
        """FEFO heat band, aligned with the design-system expiry scale."""
        d = self.days_to_expiry
        if d < 0:
            return "expired"
        if d <= 30:
            return "le_30"
        if d <= 90:
            return "le_90"
        if d <= 180:
            return "le_180"
        return "fresh"

    def __str__(self):
        return f"{self.medicine.label} · {self.batch_number} · exp {self.expiry_date}"


class StockMovement(TimeStampedModel):
    """Append-only ledger of stock changes (FEFO traceability)."""

    class Kind(models.TextChoices):
        RECEIPT = "receipt", "Goods received"
        DISPENSE = "dispense", "Dispensed / picked"
        ADJUST = "adjust", "Adjustment"
        WASTE = "waste", "Wastage"
        RETURN = "return", "Return to stock"

    batch = models.ForeignKey(StockBatch, on_delete=models.CASCADE, related_name="movements")
    kind = models.CharField(max_length=12, choices=Kind.choices)
    quantity = models.IntegerField(help_text="Signed: negative removes stock.")
    reason = models.CharField(max_length=200, blank=True)
    actor = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL)
    reference = models.CharField(max_length=80, blank=True)  # e.g. picking list / patient

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} {self.quantity} of {self.batch.medicine.label}"


class MedicineUsage(models.Model):
    """Daily aggregated dispensed quantity per medicine.

    The forecasting engine consumes this time series. Populated from dispensing
    events (and seeded with realistic history for demonstration).
    """

    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name="usage")
    date = models.DateField(db_index=True)
    quantity = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("medicine", "date")]
        ordering = ["date"]
        indexes = [models.Index(fields=["medicine", "date"])]

    def __str__(self):
        return f"{self.medicine.label} {self.date}: {self.quantity}"


# --- FEFO allocation service -------------------------------------------------

class InsufficientStock(Exception):
    pass


def fefo_allocate(medicine: Medicine, quantity: int, *, actor=None, reference="",
                  commit: bool = True):
    """Allocate `quantity` units of `medicine` across batches, soonest-expiry first.

    Skips expired batches. Returns a list of {batch, taken} allocations. When
    commit=True the allocation is applied (quantities decremented + movements
    recorded); otherwise it's a dry-run preview.
    """
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    def allocate():
        remaining = quantity
        plan = []
        batches = medicine.batches.filter(
            quantity_on_hand__gt=0,
            expiry_date__gte=date.today(),
        )
        if commit:
            batches = batches.select_for_update()
        batches = batches.order_by("expiry_date", "received_date")

        for batch in batches:
            if remaining <= 0:
                break
            take = min(batch.quantity_on_hand, remaining)
            plan.append({"batch": batch, "taken": take})
            remaining -= take

        if remaining > 0:
            raise InsufficientStock(
                f"Need {quantity} of {medicine.label}; short by {remaining} units."
            )

        if not commit:
            return plan

        for item in plan:
            batch = item["batch"]
            batch.quantity_on_hand -= item["taken"]
            batch.save(update_fields=["quantity_on_hand", "updated_at"])
            StockMovement.objects.create(
                batch=batch, kind=StockMovement.Kind.DISPENSE,
                quantity=-item["taken"], actor=actor, reference=reference,
                reason="FEFO allocation",
            )
        return plan

    if not commit:
        return allocate()
    with transaction.atomic():
        return allocate()
