"""Store-wide dispensing workflow board.

A WorkflowJob is a single unit of work that moves through the dispensing pipeline
(New → Picking → Accuracy check → Ready → Collected), or is parked as an Issue.
Jobs span all patients so staff can see the whole operation as one board.

Statuses and role rules are defined here so the API, the board and the tests all
share one source of truth. Simulated data only — no NHS/EPS, no external systems.
"""
from datetime import date

from django.db import models

from apps.core.models import TimeStampedModel


class JobType(models.TextChoices):
    PRESCRIPTION = "prescription", "Prescription"
    DOSETTE = "dosette", "Dosette / MDS"
    STOCK_ISSUE = "stock_issue", "Stock issue"


class Priority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


# Higher number = more important (used for ranking within a column).
PRIORITY_RANK = {
    Priority.LOW: 0,
    Priority.NORMAL: 1,
    Priority.HIGH: 2,
    Priority.URGENT: 3,
}


class JobStatus(models.TextChoices):
    NEW = "new", "New"
    PICKING_REQUIRED = "picking_required", "Picking required"
    PICKING_IN_PROGRESS = "picking_in_progress", "Picking in progress"
    PICKED = "picked", "Picked"
    ACCURACY_CHECK = "accuracy_check", "Accuracy check"
    READY = "ready", "Ready"
    ISSUE_FOUND = "issue_found", "Issue found"
    COLLECTED = "collected", "Collected / Delivered"


# The board renders columns in this order.
STATUS_ORDER = [
    JobStatus.NEW,
    JobStatus.PICKING_REQUIRED,
    JobStatus.PICKING_IN_PROGRESS,
    JobStatus.PICKED,
    JobStatus.ACCURACY_CHECK,
    JobStatus.READY,
    JobStatus.ISSUE_FOUND,
    JobStatus.COLLECTED,
]

TERMINAL_STATUSES = {JobStatus.COLLECTED}

# The legal "next" status from each status (before role checks). An issue can be
# raised from any active status; resolving an issue routes back into the flow.
VALID_NEXT = {
    JobStatus.NEW: {JobStatus.PICKING_REQUIRED, JobStatus.ISSUE_FOUND},
    JobStatus.PICKING_REQUIRED: {JobStatus.PICKING_IN_PROGRESS, JobStatus.ISSUE_FOUND},
    JobStatus.PICKING_IN_PROGRESS: {JobStatus.PICKED, JobStatus.ISSUE_FOUND},
    JobStatus.PICKED: {JobStatus.ACCURACY_CHECK, JobStatus.ISSUE_FOUND},
    JobStatus.ACCURACY_CHECK: {JobStatus.READY, JobStatus.ISSUE_FOUND},
    JobStatus.READY: {JobStatus.COLLECTED, JobStatus.ISSUE_FOUND},
    JobStatus.ISSUE_FOUND: {
        JobStatus.PICKING_REQUIRED, JobStatus.PICKING_IN_PROGRESS,
        JobStatus.PICKED, JobStatus.ACCURACY_CHECK, JobStatus.READY,
    },
    JobStatus.COLLECTED: set(),
}

# Reaching "Ready" is the accuracy-check pass — pharmacist/admin only (a dispenser
# may pick and raise issues but must not sign off the accuracy check).
PHARMACIST_TARGET_STATUSES = {JobStatus.READY}


def transition_is_valid(from_status, to_status) -> bool:
    """Is to_status a legal step from from_status (ignoring role)?"""
    return to_status in VALID_NEXT.get(from_status, set())


def role_can_transition(role, from_status, to_status) -> bool:
    """Role gate for a status change. Administrators may make any *valid* change."""
    if role == "administrator":
        return True
    if to_status in PHARMACIST_TARGET_STATUSES:
        return role == "pharmacist"
    if from_status == JobStatus.ISSUE_FOUND:
        # Resolving an issue back into the flow is a pharmacist/admin decision.
        return role == "pharmacist"
    # New / picking moves and raising an issue are open to dispensers too.
    return role in {"pharmacist", "dispenser"}


def role_can_create(role) -> bool:
    return role in {"administrator", "pharmacist"}


def role_can_assign(role) -> bool:
    return role == "administrator"


class WorkflowJob(TimeStampedModel):
    """One unit of dispensing work for a patient, moving through the pipeline."""

    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="workflow_jobs"
    )
    # Optional link back to the dosette cycle a dosette job prepares.
    dosette_cycle = models.ForeignKey(
        "dosette.DosetteCycle", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="workflow_jobs",
    )
    job_type = models.CharField(max_length=16, choices=JobType.choices,
                                default=JobType.DOSETTE)
    title = models.CharField(max_length=160, blank=True)
    priority = models.CharField(max_length=8, choices=Priority.choices,
                                default=Priority.NORMAL)
    status = models.CharField(max_length=20, choices=JobStatus.choices,
                              default=JobStatus.NEW)
    due_date = models.DateField(null=True, blank=True, db_index=True)
    assigned_to = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="assigned_jobs",
    )
    issue_notes = models.TextField(blank=True)
    # Persisted AI recommendation metadata (last computed); the board recomputes
    # live for display, but we keep the latest snapshot here too.
    ai_meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["due_date", "-priority"]
        indexes = [
            models.Index(fields=["status", "due_date"]),
            models.Index(fields=["job_type", "status"]),
        ]

    def __str__(self):
        return f"{self.get_job_type_display()} · {self.patient.full_name} ({self.status})"

    @property
    def priority_rank(self) -> int:
        return PRIORITY_RANK.get(self.priority, 1)

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    @property
    def is_overdue(self) -> bool:
        return bool(self.due_date and not self.is_terminal and self.due_date < date.today())

    @property
    def days_to_due(self):
        return (self.due_date - date.today()).days if self.due_date else None


class WorkflowStatusHistory(models.Model):
    """Append-only trail of status changes / assignments / issue events."""

    job = models.ForeignKey(WorkflowJob, on_delete=models.CASCADE, related_name="history")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    changed_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="workflow_changes",
    )
    changed_by_label = models.CharField(max_length=150, blank=True)  # snapshot
    note = models.CharField(max_length=255, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.job_id}: {self.from_status} → {self.to_status}"
