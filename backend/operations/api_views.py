from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils.dateparse import parse_date
from django.utils import timezone
from rest_framework import mixins, pagination, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import (
    FridgeTemperatureRolePermission,
    InternalResourceLinkRolePermission,
    LocalDeliveryRolePermission,
    OpeningHourRolePermission,
    OperationalAppointmentRolePermission,
    OperationalTaskRolePermission,
)
from accounts.roles import PharmacyRole, get_user_roles
from auditlog.models import AuditEvent
from auditlog.services import AuditedModelViewSetMixin, log_audit_event

from .models import (
    FridgeTemperatureLog,
    InternalResourceLink,
    LocalDelivery,
    OpeningHour,
    OperationalAppointment,
    OperationalTask,
)
from .serializers import (
    AppointmentCancellationSerializer,
    AppointmentCompletionSerializer,
    DeliveryOutcomeSerializer,
    FridgeTemperatureLogSerializer,
    InternalResourceLinkSerializer,
    LocalDeliverySerializer,
    OpeningHourSerializer,
    OperationalAppointmentSerializer,
    OperationalTaskSerializer,
    TaskCancellationSerializer,
)
from .services import (
    AppointmentTransitionError,
    DeliveryTransitionError,
    TaskTransitionError,
    cancel_appointment,
    cancel_delivery,
    cancel_task,
    claim_delivery,
    claim_task,
    complete_appointment,
    complete_delivery,
    complete_task,
    dispatch_delivery,
    fail_delivery,
    ready_delivery,
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


class LocalDeliveryPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class LocalDeliveryViewSet(
    AuditedModelViewSetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = LocalDeliverySerializer
    permission_classes = [LocalDeliveryRolePermission]
    pagination_class = LocalDeliveryPagination
    audit_entity_type = "LocalDelivery"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = LocalDelivery.objects.select_related(
            "patient",
            "assigned_user",
            "created_by",
        )
        delivery_status = self.request.query_params.get(
            "status",
            "",
        ).strip().upper()
        assigned = self.request.query_params.get("assigned", "").strip()
        patient_id = self.request.query_params.get("patient", "").strip()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if delivery_status:
            valid_statuses = {
                choice.value for choice in LocalDelivery.Status
            }
            if delivery_status not in valid_statuses:
                raise ValidationError(
                    {"status": "Unknown delivery status."}
                )
            queryset = queryset.filter(status=delivery_status)

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

        if patient_id:
            if not patient_id.isdigit() or int(patient_id) < 1:
                raise ValidationError(
                    {"patient": "Patient must be a positive integer."}
                )
            queryset = queryset.filter(patient_id=int(patient_id))

        if date_from:
            parsed_date_from = parse_date(date_from)
            if parsed_date_from is None:
                raise ValidationError(
                    {"date_from": "Use a valid date in YYYY-MM-DD format."}
                )
            queryset = queryset.filter(
                scheduled_date__gte=parsed_date_from
            )
        else:
            parsed_date_from = None

        if date_to:
            parsed_date_to = parse_date(date_to)
            if parsed_date_to is None:
                raise ValidationError(
                    {"date_to": "Use a valid date in YYYY-MM-DD format."}
                )
            if parsed_date_from and parsed_date_to < parsed_date_from:
                raise ValidationError(
                    {"date_to": "End date cannot be before start date."}
                )
            queryset = queryset.filter(
                scheduled_date__lte=parsed_date_to
            )

        if search:
            queryset = queryset.filter(
                Q(patient_name__icontains=search)
                | Q(assigned_username__icontains=search)
                | Q(instructions__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        creator = self.request.user
        serializer.validated_data["created_by"] = creator
        serializer.validated_data["created_by_username"] = (
            creator.get_username()
        )
        super().perform_create(serializer)

    def _log_lifecycle(self, delivery):
        log_audit_event(
            action=AuditEvent.Action.UPDATE,
            entity_type=self.audit_entity_type,
            entity_identifier=delivery.pk,
            summary=(
                "Updated LocalDelivery lifecycle status to "
                f"{delivery.get_status_display()}."
            ),
            request=self.request,
        )

    def _transition_response(self, transition, *args):
        try:
            delivery = transition(*args)
        except DeliveryTransitionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._log_lifecycle(delivery)
        return Response(self.get_serializer(delivery).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        active = queryset.exclude(
            status__in={
                LocalDelivery.Status.DELIVERED,
                LocalDelivery.Status.FAILED,
                LocalDelivery.Status.CANCELLED,
            }
        )
        today = timezone.localdate()

        return Response(
            {
                "total_visible": queryset.count(),
                "planned": queryset.filter(
                    status=LocalDelivery.Status.PLANNED
                ).count(),
                "ready": queryset.filter(
                    status=LocalDelivery.Status.READY
                ).count(),
                "out_for_delivery": queryset.filter(
                    status=LocalDelivery.Status.OUT_FOR_DELIVERY
                ).count(),
                "delivered_today": queryset.filter(
                    status=LocalDelivery.Status.DELIVERED,
                    delivered_at__date=today,
                ).count(),
                "overdue": active.filter(
                    scheduled_date__lt=today
                ).count(),
                "unassigned": active.filter(
                    assigned_user__isnull=True,
                    assigned_username="",
                ).count(),
            }
        )

    @action(detail=False, methods=["get"])
    def assignees(self, request):
        users = (
            get_user_model()
            .objects.filter(
                Q(is_superuser=True)
                | Q(
                    groups__name__in={
                        PharmacyRole.MANAGER,
                        PharmacyRole.PHARMACIST,
                        PharmacyRole.DISPENSER,
                    }
                ),
                is_active=True,
            )
            .distinct()
            .order_by("username")
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
        delivery = self.get_object()
        return self._transition_response(
            claim_delivery,
            delivery.pk,
            request.user,
        )

    @action(detail=True, methods=["post"])
    def ready(self, request, pk=None):
        delivery = self.get_object()
        return self._transition_response(ready_delivery, delivery.pk)

    @action(
        detail=True,
        methods=["post"],
        url_path="dispatch",
        url_name="dispatch",
    )
    def mark_dispatched(self, request, pk=None):
        delivery = self.get_object()
        return self._transition_response(dispatch_delivery, delivery.pk)

    @action(detail=True, methods=["post"])
    def deliver(self, request, pk=None):
        delivery = self.get_object()
        return self._transition_response(complete_delivery, delivery.pk)

    @action(detail=True, methods=["post"])
    def fail(self, request, pk=None):
        delivery = self.get_object()
        serializer = DeliveryOutcomeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._transition_response(
            fail_delivery,
            delivery.pk,
            serializer.validated_data["reason"],
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        delivery = self.get_object()
        serializer = DeliveryOutcomeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._transition_response(
            cancel_delivery,
            delivery.pk,
            serializer.validated_data["reason"],
        )


class FridgeTemperaturePagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class FridgeTemperatureLogViewSet(
    AuditedModelViewSetMixin,
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = FridgeTemperatureLogSerializer
    permission_classes = [FridgeTemperatureRolePermission]
    pagination_class = FridgeTemperaturePagination
    audit_entity_type = "FridgeTemperatureLog"

    def get_queryset(self):
        queryset = FridgeTemperatureLog.objects.select_related("recorded_by")
        range_status = self.request.query_params.get(
            "range_status",
            "",
        ).strip().upper()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()

        if range_status:
            if range_status == "WITHIN_RANGE":
                queryset = queryset.filter(
                    temperature_celsius__gte=(
                        FridgeTemperatureLog.MIN_SAFE_TEMPERATURE
                    ),
                    temperature_celsius__lte=(
                        FridgeTemperatureLog.MAX_SAFE_TEMPERATURE
                    ),
                )
            elif range_status == "OUT_OF_RANGE":
                queryset = queryset.filter(
                    Q(
                        temperature_celsius__lt=(
                            FridgeTemperatureLog.MIN_SAFE_TEMPERATURE
                        )
                    )
                    | Q(
                        temperature_celsius__gt=(
                            FridgeTemperatureLog.MAX_SAFE_TEMPERATURE
                        )
                    )
                )
            else:
                raise ValidationError(
                    {
                        "range_status": (
                            "Use WITHIN_RANGE or OUT_OF_RANGE."
                        )
                    }
                )

        parsed_date_from = None
        if date_from:
            parsed_date_from = parse_date(date_from)
            if parsed_date_from is None:
                raise ValidationError(
                    {"date_from": "Use a valid date in YYYY-MM-DD format."}
                )
            queryset = queryset.filter(
                recorded_at__date__gte=parsed_date_from
            )

        if date_to:
            parsed_date_to = parse_date(date_to)
            if parsed_date_to is None:
                raise ValidationError(
                    {"date_to": "Use a valid date in YYYY-MM-DD format."}
                )
            if parsed_date_from and parsed_date_to < parsed_date_from:
                raise ValidationError(
                    {"date_to": "End date cannot be before start date."}
                )
            queryset = queryset.filter(
                recorded_at__date__lte=parsed_date_to
            )

        return queryset

    def perform_create(self, serializer):
        recorder = self.request.user
        serializer.validated_data["recorded_by"] = recorder
        serializer.validated_data["recorded_by_username"] = (
            recorder.get_username()
        )
        super().perform_create(serializer)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        today = timezone.localdate()
        today_queryset = queryset.filter(recorded_at__date=today)
        within_today = today_queryset.filter(
            temperature_celsius__gte=(
                FridgeTemperatureLog.MIN_SAFE_TEMPERATURE
            ),
            temperature_celsius__lte=(
                FridgeTemperatureLog.MAX_SAFE_TEMPERATURE
            ),
        )
        out_of_range_today = today_queryset.exclude(
            temperature_celsius__gte=(
                FridgeTemperatureLog.MIN_SAFE_TEMPERATURE
            ),
            temperature_celsius__lte=(
                FridgeTemperatureLog.MAX_SAFE_TEMPERATURE
            ),
        )
        latest = queryset.first()

        return Response(
            {
                "latest": (
                    self.get_serializer(latest).data if latest else None
                ),
                "readings_today": today_queryset.count(),
                "within_range_today": within_today.count(),
                "out_of_range_today": out_of_range_today.count(),
                "has_reading_today": today_queryset.exists(),
                "readings_last_7_days": queryset.filter(
                    recorded_at__date__gte=today - timedelta(days=6)
                ).count(),
            }
        )


class OperationalAppointmentPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class OperationalAppointmentViewSet(
    AuditedModelViewSetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = OperationalAppointmentSerializer
    permission_classes = [OperationalAppointmentRolePermission]
    pagination_class = OperationalAppointmentPagination
    audit_entity_type = "OperationalAppointment"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = OperationalAppointment.objects.select_related(
            "patient",
            "assigned_user",
            "created_by",
        )
        appointment_status = self.request.query_params.get(
            "status",
            "",
        ).strip().upper()
        appointment_type = self.request.query_params.get(
            "appointment_type",
            "",
        ).strip().upper()
        assigned = self.request.query_params.get("assigned", "").strip()
        patient_id = self.request.query_params.get("patient", "").strip()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if appointment_status:
            valid_statuses = {
                choice.value for choice in OperationalAppointment.Status
            }
            if appointment_status not in valid_statuses:
                raise ValidationError(
                    {"status": "Unknown appointment status."}
                )
            queryset = queryset.filter(status=appointment_status)

        if appointment_type:
            valid_types = {
                choice.value
                for choice in OperationalAppointment.AppointmentType
            }
            if appointment_type not in valid_types:
                raise ValidationError(
                    {"appointment_type": "Unknown appointment type."}
                )
            queryset = queryset.filter(appointment_type=appointment_type)

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

        if patient_id:
            if not patient_id.isdigit() or int(patient_id) < 1:
                raise ValidationError(
                    {"patient": "Patient must be a positive integer."}
                )
            queryset = queryset.filter(patient_id=int(patient_id))

        parsed_date_from = None
        if date_from:
            parsed_date_from = parse_date(date_from)
            if parsed_date_from is None:
                raise ValidationError(
                    {"date_from": "Use a valid date in YYYY-MM-DD format."}
                )
            queryset = queryset.filter(
                scheduled_start__date__gte=parsed_date_from
            )

        if date_to:
            parsed_date_to = parse_date(date_to)
            if parsed_date_to is None:
                raise ValidationError(
                    {"date_to": "Use a valid date in YYYY-MM-DD format."}
                )
            if parsed_date_from and parsed_date_to < parsed_date_from:
                raise ValidationError(
                    {"date_to": "End date cannot be before start date."}
                )
            queryset = queryset.filter(
                scheduled_start__date__lte=parsed_date_to
            )

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(patient_name__icontains=search)
                | Q(assigned_username__icontains=search)
                | Q(notes__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        creator = self.request.user
        serializer.validated_data["created_by"] = creator
        serializer.validated_data["created_by_username"] = (
            creator.get_username()
        )
        super().perform_create(serializer)

    def _transition_response(self, transition, *args):
        try:
            appointment = transition(*args)
        except AppointmentTransitionError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        log_audit_event(
            action=AuditEvent.Action.UPDATE,
            entity_type=self.audit_entity_type,
            entity_identifier=appointment.pk,
            summary=(
                "Updated OperationalAppointment lifecycle status to "
                f"{appointment.get_status_display()}."
            ),
            request=self.request,
        )
        return Response(self.get_serializer(appointment).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        now = timezone.now()
        today = timezone.localdate()
        scheduled = queryset.filter(
            status=OperationalAppointment.Status.SCHEDULED
        )
        next_appointment = scheduled.filter(
            scheduled_end__gte=now
        ).first()

        return Response(
            {
                "total_visible": queryset.count(),
                "scheduled_today": scheduled.filter(
                    scheduled_start__date=today
                ).count(),
                "upcoming": scheduled.filter(
                    scheduled_end__gte=now
                ).count(),
                "overdue": scheduled.filter(
                    scheduled_end__lt=now
                ).count(),
                "completed_today": queryset.filter(
                    status=OperationalAppointment.Status.COMPLETED,
                    completed_at__date=today,
                ).count(),
                "unassigned": scheduled.filter(
                    assigned_user__isnull=True,
                    assigned_username="",
                ).count(),
                "next": (
                    self.get_serializer(next_appointment).data
                    if next_appointment
                    else None
                ),
            }
        )

    @action(detail=False, methods=["get"])
    def assignees(self, request):
        users = (
            get_user_model()
            .objects.filter(
                Q(is_superuser=True)
                | Q(
                    groups__name__in={
                        PharmacyRole.MANAGER,
                        PharmacyRole.PHARMACIST,
                        PharmacyRole.DISPENSER,
                    }
                ),
                is_active=True,
            )
            .distinct()
            .order_by("username")
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
    def complete(self, request, pk=None):
        appointment = self.get_object()
        serializer = AppointmentCompletionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._transition_response(
            complete_appointment,
            appointment.pk,
            serializer.validated_data["outcome"],
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        serializer = AppointmentCancellationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._transition_response(
            cancel_appointment,
            appointment.pk,
            serializer.validated_data["reason"],
        )


class InternalResourceLinkViewSet(
    AuditedModelViewSetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = InternalResourceLinkSerializer
    permission_classes = [InternalResourceLinkRolePermission]
    audit_entity_type = "InternalResourceLink"

    def get_queryset(self):
        queryset = InternalResourceLink.objects.select_related("created_by")
        roles = set(get_user_roles(self.request.user))
        if (
            PharmacyRole.MANAGER not in roles
            and not self.request.user.is_superuser
        ):
            queryset = queryset.filter(is_active=True)

        category = self.request.query_params.get(
            "category",
            "",
        ).strip().upper()
        search = self.request.query_params.get("search", "").strip()

        if category:
            valid_categories = {
                choice.value for choice in InternalResourceLink.Category
            }
            if category not in valid_categories:
                raise ValidationError(
                    {"category": "Unknown resource category."}
                )
            queryset = queryset.filter(category=category)

        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        creator = self.request.user
        serializer.validated_data["created_by"] = creator
        serializer.validated_data["created_by_username"] = (
            creator.get_username()
        )
        super().perform_create(serializer)
