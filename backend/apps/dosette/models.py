"""Dosette / compliance-pack management.

A patient has a DosettePlan listing medicines, each scheduled into day x time-slot
cells (Mon..Sun x Morning/Noon/Evening/Night). Cycles are generated weekly or
monthly with a due date so packs can be prepared proactively ahead of time.
"""
from datetime import date, timedelta

from django.db import models

from apps.core.models import TimeStampedModel

DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
SLOTS = ["morning", "noon", "evening", "night"]


class DosettePlan(TimeStampedModel):
    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly (4-week)"

    patient = models.ForeignKey("patients.Patient", on_delete=models.CASCADE,
                                related_name="dosette_plans")
    frequency = models.CharField(max_length=10, choices=Frequency.choices,
                                 default=Frequency.WEEKLY)
    start_date = models.DateField(default=date.today)
    review_date = models.DateField(null=True, blank=True,
                                   help_text="Dosage review due date.")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-is_active", "patient__last_name"]

    @property
    def weeks(self) -> int:
        return 4 if self.frequency == self.Frequency.MONTHLY else 1

    @property
    def review_overdue(self) -> bool:
        return bool(self.review_date and self.review_date < date.today())

    def doses_per_cycle(self):
        """Total units of each medicine needed for one full cycle."""
        totals = {}
        for item in self.items.select_related("medicine"):
            count = item.doses_per_week() * self.weeks
            totals[item.medicine_id] = totals.get(item.medicine_id, 0) + count
        return totals

    def __str__(self):
        return f"Dosette plan · {self.patient.full_name} ({self.frequency})"


class DosetteItem(TimeStampedModel):
    """A single medicine within a plan, with its day x slot schedule.

    `schedule` is a mapping of day -> list of slots, e.g.
        {"mon": ["morning", "night"], "tue": ["morning"], ...}
    `dose_quantity` is the number of units per slot occurrence.
    """

    plan = models.ForeignKey(DosettePlan, on_delete=models.CASCADE, related_name="items")
    medicine = models.ForeignKey("stock.Medicine", on_delete=models.PROTECT)
    dose_quantity = models.PositiveIntegerField(default=1)
    schedule = models.JSONField(default=dict)
    instructions = models.CharField(max_length=200, blank=True)

    def doses_per_week(self) -> int:
        occurrences = sum(len(slots) for slots in self.schedule.values())
        return occurrences * self.dose_quantity

    def __str__(self):
        return f"{self.medicine.label} in {self.plan.patient.patient_id}"


class DosetteCycle(TimeStampedModel):
    """A generated, dated instance of a plan to be prepared and checked."""

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PREP = "in_prep", "In preparation"
        ASSEMBLED = "assembled", "Assembled"
        CHECKED = "checked", "Final-checked"
        SEALED = "sealed", "Sealed"

    plan = models.ForeignKey(DosettePlan, on_delete=models.CASCADE, related_name="cycles")
    cycle_start = models.DateField()
    cycle_end = models.DateField()
    due_date = models.DateField(db_index=True, help_text="When the pack is needed.")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SCHEDULED)
    assembled_by = models.ForeignKey("accounts.User", null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="assembled_cycles")
    checked_by = models.ForeignKey("accounts.User", null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="checked_cycles")
    sealed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["due_date"]
        indexes = [models.Index(fields=["status", "due_date"])]

    @property
    def days_to_due(self) -> int:
        return (self.due_date - date.today()).days

    @property
    def is_overdue(self) -> bool:
        return self.due_date < date.today() and self.status != self.Status.SEALED

    @classmethod
    def generate_for_plan(cls, plan: DosettePlan, start: date | None = None,
                          prep_lead_days: int = 3):
        """Create the next cycle for a plan with a proactive due date."""
        start = start or date.today()
        length = 7 * plan.weeks
        end = start + timedelta(days=length - 1)
        due = start - timedelta(days=prep_lead_days)
        return cls.objects.create(
            plan=plan, cycle_start=start, cycle_end=end,
            due_date=max(due, date.today()),
        )

    def __str__(self):
        return f"Cycle {self.cycle_start}–{self.cycle_end} · {self.plan.patient.patient_id}"
