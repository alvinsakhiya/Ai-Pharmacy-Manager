from django.db import transaction
from django.db.models import Count, Q
from rest_framework import mixins, pagination, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import (
    InventoryRolePermission,
    OrderingRolePermission,
    StockMovementRolePermission,
)
from auditlog.models import AuditEvent
from auditlog.services import log_audit_event
from auditlog.services import AuditedModelViewSetMixin
from dosette.utils import InvalidDoseValue

from .models import (
    DraftPurchaseOrder,
    Medication,
    StockBatch,
    StockMovement,
    Supplier,
)
from .ordering import (
    OrderingWorkflowError,
    create_draft_purchase_order,
    generate_reorder_suggestions,
)
from .serializers import (
    DraftPurchaseOrderCreateSerializer,
    DraftPurchaseOrderSerializer,
    MedicationSerializer,
    StockAdjustmentSerializer,
    StockBatchSerializer,
    StockMovementSerializer,
    SupplierSerializer,
)
from .services import (
    StockMovementError,
    adjust_stock_batch,
    record_initial_stock_receipt,
)


class MedicationViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Medication.objects.select_related("preferred_supplier")
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


class SupplierViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [OrderingRolePermission]
    audit_entity_type = "Supplier"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = Supplier.objects.annotate(
            preferred_medication_count=Count("preferred_medications"),
        )
        search = self.request.query_params.get("search", "").strip()
        active = self.request.query_params.get("active", "").strip().lower()

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(contact_name__icontains=search)
                | Q(email__icontains=search)
                | Q(account_reference__icontains=search)
            )

        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        elif active:
            raise ValidationError(
                {"active": "Use true or false for the active filter."}
            )

        return queryset


class DraftPurchaseOrderViewSet(
    AuditedModelViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DraftPurchaseOrderSerializer
    permission_classes = [OrderingRolePermission]
    audit_entity_type = "DraftPurchaseOrder"
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = DraftPurchaseOrder.objects.select_related(
            "supplier",
            "created_by",
        ).prefetch_related("items")
        order_status = self.request.query_params.get(
            "status",
            "",
        ).strip().upper()
        supplier = self.request.query_params.get("supplier", "").strip()

        if order_status:
            valid_statuses = {
                choice.value for choice in DraftPurchaseOrder.Status
            }
            if order_status not in valid_statuses:
                raise ValidationError(
                    {"status": "Unknown draft purchase order status."}
                )
            queryset = queryset.filter(status=order_status)

        if supplier:
            if not supplier.isdigit() or int(supplier) <= 0:
                raise ValidationError(
                    {"supplier": "Use a positive supplier identifier."}
                )
            queryset = queryset.filter(supplier_id=int(supplier))

        return queryset

    @action(detail=False, methods=["get"])
    def suggestions(self, request):
        try:
            suggestion_data = generate_reorder_suggestions()
        except InvalidDoseValue as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        log_audit_event(
            action=AuditEvent.Action.ACCESS,
            entity_type="ReorderSuggestion",
            summary=(
                "Viewed reorder suggestions containing "
                f"{len(suggestion_data['items'])} medication lines."
            ),
            request=request,
        )
        return Response(suggestion_data)

    @action(
        detail=False,
        methods=["post"],
        url_path="create-from-suggestions",
    )
    def create_from_suggestions(self, request):
        serializer = DraftPurchaseOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            purchase_order = create_draft_purchase_order(
                supplier_id=serializer.validated_data["supplier"].pk,
                medication_ids=serializer.validated_data["medication_ids"],
                notes=serializer.validated_data.get("notes", ""),
                request=request,
            )
        except (InvalidDoseValue, OrderingWorkflowError) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        purchase_order = self.get_queryset().get(pk=purchase_order.pk)
        return Response(
            self.get_serializer(purchase_order).data,
            status=status.HTTP_201_CREATED,
        )
