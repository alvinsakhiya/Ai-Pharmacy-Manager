"""Dispensing workflow board API.

One ViewSet exposes the board (jobs grouped by status with AI suggestions) plus
explicit, audited actions to move jobs through the pipeline. Role rules live in
`models.py` so the API and tests share one source of truth.
"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status as http, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import User
from apps.core.audit import record

from .ai import board_summary, suggest
from .models import (
    STATUS_ORDER,
    JobStatus,
    WorkflowJob,
    WorkflowStatusHistory,
    role_can_assign,
    role_can_create,
    role_can_transition,
    transition_is_valid,
)
from .serializers import (
    AssignSerializer,
    IssueSerializer,
    ResolveIssueSerializer,
    TransitionSerializer,
    WorkflowJobSerializer,
    WorkflowJobWriteSerializer,
    WorkflowStatusHistorySerializer,
)

TRUEISH = {"1", "true", "yes", "on"}


def _role(user) -> str:
    return "administrator" if user.is_superuser else getattr(user, "role", "")


class WorkflowJobViewSet(viewsets.ModelViewSet):
    """CRUD + board + audited pipeline transitions for dispensing jobs."""

    permission_classes = [IsAuthenticated]
    serializer_class = WorkflowJobSerializer

    base_queryset = (
        WorkflowJob.objects
        .select_related("patient", "assigned_to", "dosette_cycle__plan")
    )

    def get_queryset(self):
        return self._filtered(self.base_queryset.all(), self.request)

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return WorkflowJobWriteSerializer
        return WorkflowJobSerializer

    # ----------------------------------------------------------------- filters
    def _filtered(self, qs, request):
        p = request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("job_type"):
            qs = qs.filter(job_type=p["job_type"])
        if p.get("priority"):
            qs = qs.filter(priority=p["priority"])
        if p.get("assigned_to"):
            qs = qs.filter(assigned_to_id=p["assigned_to"])
        if p.get("mine", "").lower() in TRUEISH and request.user.is_authenticated:
            qs = qs.filter(assigned_to=request.user)
        q = (p.get("q") or "").strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(
                Q(patient__first_name__icontains=q)
                | Q(patient__last_name__icontains=q)
                | Q(patient__patient_id__icontains=q)
                | Q(title__icontains=q)
            )
        return qs

    # ----------------------------------------------------------------- writes
    def create(self, request, *args, **kwargs):
        if not role_can_create(_role(request.user)):
            raise PermissionDenied("Only administrators or pharmacists can create jobs.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = serializer.save()  # status defaults to NEW (read-only on create)
        self._history(job, "", job.status, "Job created", request.user)
        record("create", "workflow.WorkflowJob", entity_id=job.id,
               summary=f"Created {job.get_job_type_display()} job for {job.patient.full_name}",
               actor=request.user)
        return Response(WorkflowJobSerializer(job).data, status=http.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        if _role(request.user) != "administrator":
            raise PermissionDenied("Only administrators can edit job details.")
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if _role(request.user) != "administrator":
            raise PermissionDenied("Only administrators can delete jobs.")
        return super().destroy(request, *args, **kwargs)

    # ----------------------------------------------------------------- helpers
    def _history(self, job, frm, to, note, user):
        WorkflowStatusHistory.objects.create(
            job=job, from_status=frm, to_status=to,
            changed_by=user if user.is_authenticated else None,
            changed_by_label=(user.get_full_name() or user.username) if user.is_authenticated else "system",
            note=note[:255],
        )

    def _apply_transition(self, job, to_status, note, request):
        """Validate (graph + role), persist, write history + audit."""
        role = _role(request.user)
        frm = job.status
        if to_status == frm:
            raise ValidationError(f"Job is already '{job.get_status_display()}'.")
        if not transition_is_valid(frm, to_status):
            raise ValidationError(
                f"Cannot move from '{frm}' to '{to_status}'."
            )
        if not role_can_transition(role, frm, to_status):
            raise PermissionDenied(
                "Your role cannot perform this transition "
                "(the accuracy check and issue resolution are pharmacist-only)."
            )
        job.status = to_status
        if to_status != JobStatus.ISSUE_FOUND:
            # leaving/clearing an issue resolution keeps the note in history only
            pass
        job.ai_meta = suggest(job) or {}
        job.save(update_fields=["status", "ai_meta", "updated_at"])
        self._history(job, frm, to_status, note, request.user)
        record(
            "check" if to_status == JobStatus.READY else "update",
            "workflow.WorkflowJob", entity_id=job.id,
            summary=f"{job.patient.full_name}: {frm} → {to_status}"
                    + (f" — {note}" if note else ""),
            actor=request.user,
        )
        return job

    # ----------------------------------------------------------------- actions
    @extend_schema(request=TransitionSerializer, responses=WorkflowJobSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def transition(self, request, pk=None):
        job = get_object_or_404(self.base_queryset.select_for_update(of=["self"]), pk=pk)
        ser = TransitionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        self._apply_transition(job, ser.validated_data["to_status"],
                               ser.validated_data["note"], request)
        return Response(WorkflowJobSerializer(job).data)

    @extend_schema(request=IssueSerializer, responses=WorkflowJobSerializer)
    @action(detail=True, methods=["post"], url_path="raise-issue")
    @transaction.atomic
    def raise_issue(self, request, pk=None):
        job = get_object_or_404(self.base_queryset.select_for_update(of=["self"]), pk=pk)
        ser = IssueSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if job.is_terminal:
            raise ValidationError("Cannot raise an issue on a collected/delivered job.")
        if job.status == JobStatus.ISSUE_FOUND:
            raise ValidationError("This job already has an open issue.")
        # Raising an issue is open to all staff (dispensers included).
        frm = job.status
        note = ser.validated_data["note"]
        job.status = JobStatus.ISSUE_FOUND
        job.issue_notes = note
        job.ai_meta = suggest(job) or {}
        job.save(update_fields=["status", "issue_notes", "ai_meta", "updated_at"])
        self._history(job, frm, JobStatus.ISSUE_FOUND, note, request.user)
        record("update", "workflow.WorkflowJob", entity_id=job.id,
               summary=f"Issue raised on {job.patient.full_name}: {note}",
               actor=request.user)
        return Response(WorkflowJobSerializer(job).data)

    @extend_schema(request=ResolveIssueSerializer, responses=WorkflowJobSerializer)
    @action(detail=True, methods=["post"], url_path="resolve-issue")
    @transaction.atomic
    def resolve_issue(self, request, pk=None):
        job = get_object_or_404(self.base_queryset.select_for_update(of=["self"]), pk=pk)
        ser = ResolveIssueSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if job.status != JobStatus.ISSUE_FOUND:
            raise ValidationError("This job has no open issue to resolve.")
        # Delegates to _apply_transition, which enforces the pharmacist/admin gate.
        self._apply_transition(job, ser.validated_data["to_status"],
                               ser.validated_data["note"] or "Issue resolved", request)
        job.issue_notes = ""
        job.save(update_fields=["issue_notes", "updated_at"])
        return Response(WorkflowJobSerializer(job).data)

    @extend_schema(request=AssignSerializer, responses=WorkflowJobSerializer)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def assign(self, request, pk=None):
        if not role_can_assign(_role(request.user)):
            raise PermissionDenied("Only administrators can assign jobs.")
        job = get_object_or_404(self.base_queryset.select_for_update(of=["self"]), pk=pk)
        ser = AssignSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        uid = ser.validated_data.get("assigned_to")
        assignee = None
        if uid is not None:
            assignee = get_object_or_404(User, pk=uid)
        job.assigned_to = assignee
        job.save(update_fields=["assigned_to", "updated_at"])
        label = assignee.get_full_name() or assignee.username if assignee else "Unassigned"
        self._history(job, job.status, job.status, f"Assigned: {label}", request.user)
        record("update", "workflow.WorkflowJob", entity_id=job.id,
               summary=f"{job.patient.full_name}: assigned to {label}",
               actor=request.user)
        return Response(WorkflowJobSerializer(job).data)

    @extend_schema(responses=WorkflowStatusHistorySerializer(many=True))
    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        job = get_object_or_404(self.base_queryset, pk=pk)
        rows = job.history.select_related("changed_by")
        return Response(WorkflowStatusHistorySerializer(rows, many=True).data)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["get"])
    def board(self, request):
        """Jobs grouped into status columns, with counts and an AI summary.

        Collected/Delivered jobs are excluded unless ?include_collected=1.
        """
        qs = self._filtered(self.base_queryset.all(), request)
        include_collected = request.query_params.get("include_collected", "").lower() in TRUEISH
        jobs = list(qs)
        if not include_collected and not request.query_params.get("status"):
            jobs = [j for j in jobs if j.status != JobStatus.COLLECTED]

        by_status = {s: [] for s in STATUS_ORDER}
        for job in jobs:
            by_status.setdefault(job.status, []).append(job)

        def sort_key(j):
            # Highest priority first, overdue first, then soonest due date.
            return (-j.priority_rank, not j.is_overdue, j.due_date or _LATE)

        columns = []
        for s in STATUS_ORDER:
            col_jobs = sorted(by_status.get(s, []), key=sort_key)
            columns.append({
                "status": s,
                "label": JobStatus(s).label,
                "count": len(col_jobs),
                "jobs": WorkflowJobSerializer(col_jobs, many=True).data,
            })

        return Response({
            "columns": columns,
            "total": len(jobs),
            "counts": {s: len(by_status.get(s, [])) for s in STATUS_ORDER},
            "ai_summary": board_summary(jobs),
        })


# A far-future sentinel so jobs without a due date sort last (avoids Date.now in code).
from datetime import date as _date  # noqa: E402

_LATE = _date(9999, 12, 31)
