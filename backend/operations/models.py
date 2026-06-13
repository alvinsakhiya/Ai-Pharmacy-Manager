from django.conf import settings
from django.db import models
from django.utils import timezone


class OperationalTask(models.Model):
    class Category(models.TextChoices):
        GENERAL = "GENERAL", "General operations"
        STOCK = "STOCK", "Stock"
        DOSETTE = "DOSETTE", "Dosette"
        DELIVERY = "DELIVERY", "Delivery"
        GOVERNANCE = "GOVERNANCE", "Governance"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    class Status(models.TextChoices):
        TODO = "TODO", "To do"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, max_length=3000)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.GENERAL,
        db_index=True,
    )
    priority = models.CharField(
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TODO,
        db_index=True,
    )
    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="operational_tasks",
    )
    assigned_username = models.CharField(max_length=150, blank=True)
    due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_operational_tasks",
    )
    created_by_username = models.CharField(max_length=150, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "due_at", "-created_at"]
        indexes = [
            models.Index(
                fields=["assigned_user", "status", "due_at"],
                name="ops_task_user_status_due",
            ),
            models.Index(
                fields=["category", "priority", "status"],
                name="ops_task_category_priority",
            ),
        ]

    @property
    def is_overdue(self):
        return bool(
            self.due_at
            and self.due_at < timezone.now()
            and self.status
            not in {self.Status.COMPLETED, self.Status.CANCELLED}
        )

    def __str__(self):
        return self.title


class OpeningHour(models.Model):
    class Day(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    day_of_week = models.PositiveSmallIntegerField(
        choices=Day.choices,
        unique=True,
    )
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)
    notes = models.CharField(max_length=250, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["day_of_week"]

    def __str__(self):
        if self.is_closed:
            return f"{self.get_day_of_week_display()}: Closed"
        return (
            f"{self.get_day_of_week_display()}: "
            f"{self.opening_time}-{self.closing_time}"
        )


class LocalDelivery(models.Model):
    class Window(models.TextChoices):
        ANYTIME = "ANYTIME", "Any time"
        MORNING = "MORNING", "Morning"
        AFTERNOON = "AFTERNOON", "Afternoon"
        EVENING = "EVENING", "Evening"

    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planned"
        READY = "READY", "Ready"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for delivery"
        DELIVERED = "DELIVERED", "Delivered"
        FAILED = "FAILED", "Delivery failed"
        CANCELLED = "CANCELLED", "Cancelled"

    patient = models.ForeignKey(
        "patients.Patient",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="local_deliveries",
    )
    patient_name = models.CharField(max_length=201)
    scheduled_date = models.DateField(db_index=True)
    delivery_window = models.CharField(
        max_length=20,
        choices=Window.choices,
        default=Window.ANYTIME,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNED,
        db_index=True,
    )
    assigned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="local_deliveries",
    )
    assigned_username = models.CharField(max_length=150, blank=True)
    instructions = models.TextField(blank=True, max_length=1000)
    outcome_notes = models.TextField(blank=True, max_length=1000)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_local_deliveries",
    )
    created_by_username = models.CharField(max_length=150, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_date", "status", "-created_at"]
        indexes = [
            models.Index(
                fields=["scheduled_date", "status"],
                name="ops_delivery_date_status",
            ),
            models.Index(
                fields=["assigned_user", "status"],
                name="ops_delivery_user_status",
            ),
        ]

    @property
    def is_overdue(self):
        return bool(
            self.scheduled_date < timezone.localdate()
            and self.status
            not in {
                self.Status.DELIVERED,
                self.Status.FAILED,
                self.Status.CANCELLED,
            }
        )

    def __str__(self):
        return (
            f"{self.patient_name} - {self.scheduled_date} "
            f"({self.get_status_display()})"
        )
