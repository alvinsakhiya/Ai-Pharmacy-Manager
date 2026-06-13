"""Picking lists: aggregate the medicine quantities needed to prepare the
active dosette cycles for a period, with per-line completion tracking."""
from datetime import date

from django.db import models

from apps.core.models import TimeStampedModel


class PickingList(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETE = "complete", "Complete"

    name = models.CharField(max_length=120)
    period_start = models.DateField(default=date.today)
    period_end = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-period_start"]

    @property
    def progress(self) -> float:
        total = self.items.count()
        if not total:
            return 0.0
        done = self.items.filter(is_picked=True).count()
        return round(done / total * 100, 1)

    def refresh_status(self):
        items = self.items.all()
        if items and all(i.is_picked for i in items):
            self.status = self.Status.COMPLETE
        elif self.items.filter(is_picked=True).exists():
            self.status = self.Status.IN_PROGRESS
        else:
            self.status = self.Status.OPEN
        self.save(update_fields=["status", "updated_at"])

    def __str__(self):
        return f"{self.name} ({self.period_start}–{self.period_end})"


class PickingItem(TimeStampedModel):
    picking_list = models.ForeignKey(PickingList, on_delete=models.CASCADE, related_name="items")
    medicine = models.ForeignKey("stock.Medicine", on_delete=models.PROTECT)
    quantity_required = models.PositiveIntegerField()
    quantity_available = models.PositiveIntegerField(default=0)
    patient_count = models.PositiveIntegerField(default=0)
    is_picked = models.BooleanField(default=False)
    picked_by = models.ForeignKey("accounts.User", null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="picked_items")
    picked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["medicine__name"]

    @property
    def is_short(self) -> bool:
        return self.quantity_available < self.quantity_required

    def __str__(self):
        return f"{self.medicine.label} x{self.quantity_required}"
