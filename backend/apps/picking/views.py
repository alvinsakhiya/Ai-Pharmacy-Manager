from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.audit import record
from apps.core.permissions import RolePermission
from apps.reports.pdf import picking_list_pdf

from .models import PickingItem, PickingList
from .serializers import (
    PickingItemSerializer,
    PickingListGenerateSerializer,
    PickingListDetailSerializer,
    PickingListSerializer,
)
from .services import generate_picking_list


class PickingListViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PickingList.objects.prefetch_related("items__medicine")
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist", "dispenser"]
    filterset_fields = ["status"]

    def get_serializer_class(self):
        return PickingListDetailSerializer if self.action == "retrieve" else PickingListSerializer

    @action(detail=False, methods=["post"])
    def generate(self, request):
        serializer = PickingListGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        start = serializer.validated_data["period_start"]
        weeks = serializer.validated_data["weeks"]
        plist = generate_picking_list(start, weeks, created_by=request.user)
        record("create", "picking.PickingList", entity_id=plist.id,
               summary=f"Generated {plist.name} with {plist.items.count()} lines",
               actor=request.user)
        return Response(PickingListDetailSerializer(plist).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        plist = self.get_object()
        pdf_bytes = picking_list_pdf(plist)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="picking-{plist.id}.pdf"'
        return resp


class PickingItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PickingItem.objects.select_related("medicine", "picking_list")
    serializer_class = PickingItemSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist", "dispenser"]
    filterset_fields = ["picking_list", "is_picked"]

    @action(detail=True, methods=["post"], url_path="toggle-picked")
    @transaction.atomic
    def toggle_picked(self, request, pk=None):
        queryset = self.filter_queryset(self.get_queryset()).select_for_update()
        item = get_object_or_404(queryset, pk=pk)
        self.check_object_permissions(request, item)
        item.is_picked = not item.is_picked
        item.picked_by = request.user if item.is_picked else None
        item.picked_at = timezone.now() if item.is_picked else None
        item.save(update_fields=["is_picked", "picked_by", "picked_at", "updated_at"])
        item.picking_list.refresh_status()
        return Response(self.get_serializer(item).data)
