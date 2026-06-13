from datetime import date, datetime

from django.http import HttpResponse
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
    PickingListDetailSerializer,
    PickingListSerializer,
)
from .services import generate_picking_list


class PickingListViewSet(viewsets.ModelViewSet):
    queryset = PickingList.objects.prefetch_related("items__medicine")
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist", "dispenser"]
    filterset_fields = ["status"]

    def get_serializer_class(self):
        return PickingListDetailSerializer if self.action == "retrieve" else PickingListSerializer

    @action(detail=False, methods=["post"])
    def generate(self, request):
        start = request.data.get("period_start")
        start = datetime.strptime(start, "%Y-%m-%d").date() if start else date.today()
        weeks = int(request.data.get("weeks", 1))
        plist = generate_picking_list(start, weeks, created_by=request.user)
        record("create", "picking.PickingList", entity_id=plist.id,
               summary=f"Generated {plist.name} with {plist.items.count()} lines")
        return Response(PickingListDetailSerializer(plist).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        plist = self.get_object()
        pdf_bytes = picking_list_pdf(plist)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="picking-{plist.id}.pdf"'
        return resp


class PickingItemViewSet(viewsets.ModelViewSet):
    queryset = PickingItem.objects.select_related("medicine", "picking_list")
    serializer_class = PickingItemSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist", "dispenser"]
    filterset_fields = ["picking_list", "is_picked"]

    @action(detail=True, methods=["post"], url_path="toggle-picked")
    def toggle_picked(self, request, pk=None):
        item = self.get_object()
        item.is_picked = not item.is_picked
        item.picked_by = request.user if item.is_picked else None
        item.picked_at = timezone.now() if item.is_picked else None
        item.save(update_fields=["is_picked", "picked_by", "picked_at", "updated_at"])
        item.picking_list.refresh_status()
        return Response(self.get_serializer(item).data)
