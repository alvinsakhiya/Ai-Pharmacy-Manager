from datetime import date, timedelta

from django.db import transaction
from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.audit import record
from apps.core.permissions import RolePermission

from .models import (
    Manufacturer,
    Medicine,
    StockBatch,
    StockMovement,
    Supplier,
    fefo_allocate,
    InsufficientStock,
)
from .serializers import (
    AdjustmentSerializer,
    FefoPreviewSerializer,
    ManufacturerSerializer,
    MedicineDetailSerializer,
    MedicineSerializer,
    StockBatchSerializer,
    StockMovementSerializer,
    SupplierSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist"]
    search_fields = ["name", "account_ref"]

    def perform_create(self, serializer):
        supplier = serializer.save()
        record("create", "stock.Supplier", entity_id=supplier.id,
               summary=f"Created supplier {supplier.name}", actor=self.request.user)

    def perform_update(self, serializer):
        supplier = serializer.save()
        record("update", "stock.Supplier", entity_id=supplier.id,
               summary=f"Updated supplier {supplier.name}", actor=self.request.user)


class ManufacturerViewSet(viewsets.ModelViewSet):
    queryset = Manufacturer.objects.all()
    serializer_class = ManufacturerSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist"]
    search_fields = ["name"]

    def perform_create(self, serializer):
        manufacturer = serializer.save()
        record("create", "stock.Manufacturer", entity_id=manufacturer.id,
               summary=f"Created manufacturer {manufacturer.name}", actor=self.request.user)

    def perform_update(self, serializer):
        manufacturer = serializer.save()
        record("update", "stock.Manufacturer", entity_id=manufacturer.id,
               summary=f"Updated manufacturer {manufacturer.name}", actor=self.request.user)


class MedicineViewSet(viewsets.ModelViewSet):
    queryset = (
        Medicine.objects.with_stock_totals()
        .select_related("manufacturer", "default_supplier")
    )
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist"]
    filterset_fields = ["form", "is_active", "manufacturer", "default_supplier"]
    search_fields = ["name", "strength"]
    ordering_fields = ["name", "reorder_level"]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_serializer_class(self):
        return MedicineDetailSerializer if self.action == "retrieve" else MedicineSerializer

    def perform_create(self, serializer):
        medicine = serializer.save()
        record("create", "stock.Medicine", entity_id=medicine.id,
               summary=f"Created medicine {medicine.label}", actor=self.request.user)

    def perform_update(self, serializer):
        medicine = serializer.save()
        record("update", "stock.Medicine", entity_id=medicine.id,
               summary=f"Updated medicine {medicine.label}", actor=self.request.user)

    @action(detail=False, methods=["get"])
    def low_stock(self, request):
        """Medicines at or below their reorder level."""
        items = self.get_queryset().filter(
            _quantity_on_hand__lte=F("reorder_level")
        )
        page = self.paginate_queryset(items)
        data = MedicineSerializer(page if page is not None else items, many=True).data
        return self.get_paginated_response(data) if page is not None else Response(data)

    @action(detail=True, methods=["post"], url_path="fefo-preview")
    def fefo_preview(self, request, pk=None):
        """Dry-run FEFO allocation for a requested quantity."""
        medicine = self.get_object()
        serializer = FefoPreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        qty = serializer.validated_data["quantity"]
        try:
            plan = fefo_allocate(medicine, qty, commit=False)
        except InsufficientStock as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response([
            {"batch_id": p["batch"].id, "batch_number": p["batch"].batch_number,
             "expiry_date": p["batch"].expiry_date, "taken": p["taken"]}
            for p in plan
        ])


class StockBatchViewSet(viewsets.ModelViewSet):
    queryset = StockBatch.objects.select_related("medicine", "supplier")
    serializer_class = StockBatchSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist", "dispenser"]
    filterset_fields = ["medicine", "supplier", "location"]
    search_fields = ["batch_number", "medicine__name", "location"]
    ordering_fields = ["expiry_date", "quantity_on_hand"]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        band = self.request.query_params.get("expiry_within")
        if band in {"30", "90", "180"}:
            cutoff = date.today() + timedelta(days=int(band))
            qs = qs.filter(expiry_date__lte=cutoff, expiry_date__gte=date.today())
        if self.request.query_params.get("expired") == "true":
            qs = qs.filter(expiry_date__lt=date.today())
        return qs

    def perform_create(self, serializer):
        batch = serializer.save(
            quantity_on_hand=serializer.validated_data.get("quantity_received", 0)
        )
        StockMovement.objects.create(
            batch=batch, kind=StockMovement.Kind.RECEIPT,
            quantity=batch.quantity_on_hand, actor=self.request.user,
            reason="Goods received",
        )
        record("create", "stock.StockBatch", entity_id=batch.id,
               summary=f"Received {batch.quantity_on_hand} of {batch.medicine.label} (batch {batch.batch_number})",
               actor=self.request.user)

    def perform_update(self, serializer):
        batch = serializer.save()
        record("update", "stock.StockBatch", entity_id=batch.id,
               summary=f"Updated batch {batch.batch_number} for {batch.medicine.label}",
               actor=self.request.user)


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related("batch__medicine", "actor")
    serializer_class = StockMovementSerializer
    permission_classes = [RolePermission]
    filterset_fields = ["kind", "batch", "batch__medicine"]
    search_fields = ["reference", "reason", "batch__medicine__name"]

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def adjust(self, request):
        """Record a stock adjustment, wastage, or return against a batch."""
        ser = AdjustmentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        batch = StockBatch.objects.select_for_update().get(
            pk=ser.validated_data["batch"].pk
        )
        qty = ser.validated_data["quantity"]
        kind = ser.validated_data["kind"]
        new_qty = batch.quantity_on_hand + qty
        if new_qty < 0:
            return Response({"detail": "Adjustment would make stock negative."},
                            status=status.HTTP_400_BAD_REQUEST)
        batch.quantity_on_hand = new_qty
        batch.save(update_fields=["quantity_on_hand", "updated_at"])
        movement = StockMovement.objects.create(
            batch=batch, kind=kind, quantity=qty, actor=request.user,
            reason=ser.validated_data["reason"],
        )
        audit_action = "waste" if kind == "waste" else "adjust"
        record(audit_action, "stock.StockBatch", entity_id=batch.id,
               summary=f"{kind.title()} {qty} of {batch.medicine.label}",
               detail={"reason": ser.validated_data["reason"]},
               actor=request.user)
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)
