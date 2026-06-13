from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.audit import record
from apps.core.permissions import IsPharmacistOrAdmin, RolePermission

from .models import DosetteCycle, DosetteItem, DosettePlan
from .serializers import (
    DosetteCycleSerializer,
    DosetteItemSerializer,
    DosettePlanDetailSerializer,
    DosettePlanSerializer,
)


class DosettePlanViewSet(viewsets.ModelViewSet):
    queryset = DosettePlan.objects.select_related("patient").prefetch_related("items")
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist"]
    filterset_fields = ["is_active", "frequency", "patient"]
    search_fields = ["patient__first_name", "patient__last_name", "patient__patient_id"]

    def get_serializer_class(self):
        return DosettePlanDetailSerializer if self.action == "retrieve" else DosettePlanSerializer

    @action(detail=True, methods=["post"], url_path="generate-cycle")
    def generate_cycle(self, request, pk=None):
        plan = self.get_object()
        cycle = DosetteCycle.generate_for_plan(plan)
        record("create", "dosette.DosetteCycle", entity_id=cycle.id,
               summary=f"Generated cycle for {plan.patient.patient_id} due {cycle.due_date}")
        return Response(DosetteCycleSerializer(cycle).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        """Printable patient-facing compliance-pack medication summary."""
        from apps.reports.pdf import dosette_summary_pdf

        plan = self.get_object()
        pdf_bytes = dosette_summary_pdf(plan)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = (
            f'attachment; filename="dosette-{plan.patient.patient_id}.pdf"')
        return resp


class DosetteItemViewSet(viewsets.ModelViewSet):
    queryset = DosetteItem.objects.select_related("medicine", "plan")
    serializer_class = DosetteItemSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist"]
    filterset_fields = ["plan"]


class DosetteCycleViewSet(viewsets.ModelViewSet):
    queryset = DosetteCycle.objects.select_related("plan__patient")
    serializer_class = DosetteCycleSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist", "dispenser"]
    filterset_fields = ["status", "plan"]
    ordering_fields = ["due_date", "cycle_start"]

    @action(detail=True, methods=["post"])
    def assemble(self, request, pk=None):
        """Dispenser marks a pack assembled (potted)."""
        cycle = self.get_object()
        cycle.status = DosetteCycle.Status.ASSEMBLED
        cycle.assembled_by = request.user
        cycle.save(update_fields=["status", "assembled_by", "updated_at"])
        record("dispense", "dosette.DosetteCycle", entity_id=cycle.id,
               summary=f"Pack assembled for {cycle.plan.patient.patient_id}")
        return Response(self.get_serializer(cycle).data)

    @action(detail=True, methods=["post"], permission_classes=[IsPharmacistOrAdmin])
    def final_check(self, request, pk=None):
        """Pharmacist's final verification (safety-critical, restricted role)."""
        cycle = self.get_object()
        if cycle.status != DosetteCycle.Status.ASSEMBLED:
            return Response({"detail": "Pack must be assembled before final check."},
                            status=status.HTTP_400_BAD_REQUEST)
        cycle.status = DosetteCycle.Status.CHECKED
        cycle.checked_by = request.user
        cycle.save(update_fields=["status", "checked_by", "updated_at"])
        record("check", "dosette.DosetteCycle", entity_id=cycle.id,
               summary=f"Final check passed for {cycle.plan.patient.patient_id}")
        return Response(self.get_serializer(cycle).data)

    @action(detail=True, methods=["post"])
    def seal(self, request, pk=None):
        cycle = self.get_object()
        if cycle.status != DosetteCycle.Status.CHECKED:
            return Response({"detail": "Pack must pass final check before sealing."},
                            status=status.HTTP_400_BAD_REQUEST)
        cycle.status = DosetteCycle.Status.SEALED
        cycle.sealed_at = timezone.now()
        cycle.save(update_fields=["status", "sealed_at", "updated_at"])
        record("check", "dosette.DosetteCycle", entity_id=cycle.id,
               summary=f"Pack sealed for {cycle.plan.patient.patient_id}")
        return Response(self.get_serializer(cycle).data)
