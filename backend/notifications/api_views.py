from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import pagination, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import NotificationRolePermission
from accounts.roles import PharmacyRole, get_user_roles
from auditlog.models import AuditEvent
from auditlog.services import AuditedModelViewSetMixin, log_audit_event

from .models import Notification
from .serializers import NotificationSerializer, ResolutionSerializer
from .services import (
    NotificationTransitionError,
    acknowledge_notification,
    mark_notification_read,
    resolve_notification,
)


class NotificationPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class NotificationViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [NotificationRolePermission]
    pagination_class = NotificationPagination
    audit_entity_type = "Notification"

    def _is_manager(self):
        return PharmacyRole.MANAGER in get_user_roles(self.request.user)

    def get_queryset(self):
        queryset = Notification.objects.select_related("assigned_user")

        if not self._is_manager():
            queryset = queryset.filter(
                Q(assigned_user=self.request.user)
                | Q(
                    assigned_user__isnull=True,
                    assigned_username="",
                )
            )

        notification_status = self.request.query_params.get(
            "status",
            "",
        ).strip().upper()
        priority = self.request.query_params.get(
            "priority",
            "",
        ).strip().upper()
        assigned = self.request.query_params.get("assigned", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if notification_status:
            valid_statuses = {
                choice.value for choice in Notification.Status
            }
            if notification_status not in valid_statuses:
                raise ValidationError({"status": "Unknown notification status."})
            queryset = queryset.filter(status=notification_status)

        if priority:
            valid_priorities = {
                choice.value for choice in Notification.Priority
            }
            if priority not in valid_priorities:
                raise ValidationError(
                    {"priority": "Unknown notification priority."}
                )
            queryset = queryset.filter(priority=priority)

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
                | Q(message__icontains=search)
                | Q(assigned_username__icontains=search)
                | Q(related_entity_type__icontains=search)
                | Q(related_entity_id__icontains=search)
            )

        return queryset

    def _log_status_change(self, notification):
        log_audit_event(
            action=AuditEvent.Action.UPDATE,
            entity_type=self.audit_entity_type,
            entity_identifier=notification.pk,
            summary=(
                "Updated Notification lifecycle status to "
                f"{notification.get_status_display()}."
            ),
            request=self.request,
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        unresolved = queryset.exclude(status=Notification.Status.RESOLVED)
        today = timezone.localdate()

        return Response(
            {
                "total_visible": queryset.count(),
                "new": queryset.filter(
                    status=Notification.Status.NEW
                ).count(),
                "acknowledged": queryset.filter(
                    status=Notification.Status.ACKNOWLEDGED
                ).count(),
                "unresolved": unresolved.count(),
                "critical": unresolved.filter(
                    priority=Notification.Priority.CRITICAL
                ).count(),
                "overdue": unresolved.filter(due_date__lt=today).count(),
                "expired": unresolved.filter(expiry_date__lt=today).count(),
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

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()

        try:
            notification, changed = mark_notification_read(notification.pk)
        except NotificationTransitionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if changed:
            self._log_status_change(notification)

        return Response(self.get_serializer(notification).data)

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        notification = self.get_object()

        try:
            notification, changed = acknowledge_notification(notification.pk)
        except NotificationTransitionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if changed:
            self._log_status_change(notification)

        return Response(self.get_serializer(notification).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        notification = self.get_object()
        serializer = ResolutionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            notification = resolve_notification(
                notification.pk,
                serializer.validated_data["resolution_reason"],
            )
        except NotificationTransitionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._log_status_change(notification)
        return Response(self.get_serializer(notification).data)
