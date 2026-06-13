from django.db import transaction
from django.db.models import Q
from rest_framework import pagination, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import (
    InventoryRolePermission,
    StockMovementRolePermission,
)
from auditlog.models import AuditEvent
from auditlog.services import log_audit_event
from auditlog.services import AuditedModelViewSetMixin
from .models import Medication, StockBatch, StockMovement
from .serializers import (
    MedicationSerializer,
    StockAdjustmentSerializer,
    StockBatchSerializer,
    StockMovementSerializer,
)
from .services import (
    StockMovementError,
    adjust_stock_batch,
    record_initial_stock_receipt,
)


class MedicationViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Medication.objects.all()
    serializer_class = MedicationSerializer
    audit_entity_type = "Medication"
    permission_classes = [InventoryRolePermission]


class StockBatchViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = StockBatch.objects.select_related("medication").all()
    serializer_class = StockBatchSerializer
    audit_entity_type = "StockBatch"
    permission_classes = [InventoryRolePermission]

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            record_initial_stock_receipt(instance, request=self.request)
            log_audit_event(
                action=AuditEvent.Action.CREATE,
                entity_type=self.get_audit_entity_type(instance),
                entity_identifier=self.get_audit_identifier(instance),
                summary="Created StockBatch record.",
                request=self.request,
            )

    @action(detail=True, methods=["post"], url_path="adjust")
    def adjust(self, request, pk=None):
        batch = self.get_object()
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            movement = adjust_stock_batch(
                batch_id=batch.pk,
                request=request,
                **serializer.validated_data,
            )
        except StockMovementError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "batch": StockBatchSerializer(movement.stock_batch).data,
                "movement": StockMovementSerializer(movement).data,
            },
            status=status.HTTP_200_OK,
        )


class StockMovementPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    pagination_class = StockMovementPagination
    permission_classes = [StockMovementRolePermission]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        queryset = StockMovement.objects.select_related(
            "stock_batch",
            "actor",
        )
        movement_type = self.request.query_params.get(
            "movement_type",
            "",
        ).strip().upper()
        stock_batch = self.request.query_params.get(
            "stock_batch",
            "",
        ).strip()
        search = self.request.query_params.get("search", "").strip()

        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)

        if stock_batch:
            queryset = queryset.filter(stock_batch_identifier=stock_batch)

        if search:
            queryset = queryset.filter(
                Q(medication_name__icontains=search)
                | Q(batch_number__icontains=search)
                | Q(reason__icontains=search)
                | Q(actor_username__icontains=search)
            )

        return queryset
