from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import pagination, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import (
    OpeningHourRolePermission,
    OperationalTaskRolePermission,
)
from accounts.roles import PharmacyRole, get_user_roles
from auditlog.models import AuditEvent
from auditlog.services import AuditedModelViewSetMixin, log_audit_event

from .models import OpeningHour, OperationalTask
from .serializers import (
    OpeningHourSerializer,
    OperationalTaskSerializer,
    TaskCancellationSerializer,
)
from .services import (
    TaskTransitionError,
    cancel_task,
    claim_task,
    complete_task,
    start_task,
)


class OperationalTaskPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class OperationalTaskViewSet(
    AuditedModelViewSetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = OperationalTaskSerializer
    permission_classes = [OperationalTaskRolePermission]
    pagination_class = OperationalTaskPagination
    audit_entity_type = "OperationalTask"

    def _is_manager(self):
        return PharmacyRole.MANAGER in get_user_roles(self.request.user)

    def get_queryset(self):
        queryset = OperationalTask.objects.select_related(
            "assigned_user",
            "created_by",
        )

        if not self._is_manager():
            queryset = queryset.filter(
                Q(assigned_user=self.request.user)
                | Q(
                    assigned_user__isnull=True,
                    assigned_username="",
                )
            )

        task_status = self.request.query_params.get(
            "status",
            "",
        ).strip().upper()
        priority = self.request.query_params.get(
            "priority",
            "",
        ).strip().upper()
        category = self.request.query_params.get(
            "category",
            "",
        ).strip().upper()
        assigned = self.request.query_params.get("assigned", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if task_status:
            valid_statuses = {
                choice.value for choice in OperationalTask.Status
            }
            if task_status not in valid_statuses:
                raise ValidationError({"status": "Unknown task status."})
            queryset = queryset.filter(status=task_status)

        if priority:
            valid_priorities = {
                choice.value for choice in OperationalTask.Priority
            }
            if priority not in valid_priorities:
                raise ValidationError({"priority": "Unknown task priority."})
            queryset = queryset.filter(priority=priority)

        if category:
            valid_categories = {
                choice.value for choice in OperationalTask.Category
            }
            if category not in valid_categories:
                raise ValidationError({"category": "Unknown task category."})
            queryset = queryset.filter(category=category)

        if assigned:
            if assigned.lower() == "me":
                queryset = queryset.filter(assigned_user=self.request.user)
            elif assigned.lower() == "unassigned":
                queryset = queryset.filter(
                    assigned_user__isnull=True,
                    assigned_username="",
                )
            elif assigned.isdigit() and int(assigned) > 0:
                queryset = queryset.filter(assigned_user_id=int(assigned))
            else:
                raise ValidationError(
                    {"assigned": "Use me, unassigned, or a positive user id."}
                )

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(assigned_username__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        creator = self.request.user
        serializer.validated_data["created_by"] = creator
        serializer.validated_data["created_by_username"] = (
            creator.get_username()
        )
        super().perform_create(serializer)

    def _log_lifecycle(self, task):
        log_audit_event(
            action=AuditEvent.Action.UPDATE,
            entity_type=self.audit_entity_type,
            entity_identifier=task.pk,
            summary=(
                "Updated OperationalTask lifecycle status to "
                f"{task.get_status_display()}."
            ),
            request=self.request,
        )

    def _transition_response(self, transition, *args):
        try:
            task = transition(*args)
        except TaskTransitionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._log_lifecycle(task)
        return Response(self.get_serializer(task).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        active = queryset.exclude(
            status__in={
                OperationalTask.Status.COMPLETED,
                OperationalTask.Status.CANCELLED,
            }
        )

        return Response(
            {
                "total_visible": queryset.count(),
                "to_do": queryset.filter(
                    status=OperationalTask.Status.TODO
                ).count(),
                "in_progress": queryset.filter(
                    status=OperationalTask.Status.IN_PROGRESS
                ).count(),
                "completed": queryset.filter(
                    status=OperationalTask.Status.COMPLETED
                ).count(),
                "critical": active.filter(
                    priority=OperationalTask.Priority.CRITICAL
                ).count(),
                "overdue": active.filter(due_at__lt=timezone.now()).count(),
                "unassigned": active.filter(
                    assigned_user__isnull=True,
                    assigned_username="",
                ).count(),
            }
        )

    @action(detail=False, methods=["get"])
    def assignees(self, request):
        users = get_user_model().objects.filter(is_active=True).order_by(
            "username"
        )
        return Response(
            [
                {
                    "id": user.pk,
                    "username": user.get_username(),
                    "display_name": user.get_full_name() or user.get_username(),
                    "roles": get_user_roles(user),
                }
                for user in users
            ]
        )

    @action(detail=True, methods=["post"])
    def claim(self, request, pk=None):
        task = self.get_object()
        return self._transition_response(claim_task, task.pk, request.user)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        task = self.get_object()
        return self._transition_response(start_task, task.pk)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        return self._transition_response(complete_task, task.pk)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        task = self.get_object()
        serializer = TaskCancellationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._transition_response(
            cancel_task,
            task.pk,
            serializer.validated_data["reason"],
        )


class OpeningHourViewSet(
    AuditedModelViewSetMixin,
    viewsets.ModelViewSet,
):
    queryset = OpeningHour.objects.all()
    serializer_class = OpeningHourSerializer
    permission_classes = [OpeningHourRolePermission]
    audit_entity_type = "OpeningHour"
