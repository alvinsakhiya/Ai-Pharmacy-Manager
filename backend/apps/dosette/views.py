from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
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

    def perform_create(self, serializer):
        plan = serializer.save()
        record("create", "dosette.DosettePlan", entity_id=plan.id,
               summary=f"Created dosette plan for {plan.patient.patient_id}",
               actor=self.request.user)

    def perform_update(self, serializer):
        plan = serializer.save()
        record("update", "dosette.DosettePlan", entity_id=plan.id,
               summary=f"Updated dosette plan for {plan.patient.patient_id}",
               actor=self.request.user)

    @action(detail=True, methods=["post"], url_path="generate-cycle")
    def generate_cycle(self, request, pk=None):
        plan = self.get_object()
        cycle = DosetteCycle.generate_for_plan(plan)
        record("create", "dosette.DosetteCycle", entity_id=cycle.id,
               summary=f"Generated cycle for {plan.patient.patient_id} due {cycle.due_date}",
               actor=request.user)
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

    def perform_create(self, serializer):
        item = serializer.save()
        record("create", "dosette.DosetteItem", entity_id=item.id,
               summary=f"Added {item.medicine.label} to plan {item.plan_id}",
               actor=self.request.user)

    def perform_update(self, serializer):
        item = serializer.save()
        record("update", "dosette.DosetteItem", entity_id=item.id,
               summary=f"Updated {item.medicine.label} on plan {item.plan_id}",
               actor=self.request.user)


class DosetteCycleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DosetteCycle.objects.select_related("plan__patient")
    serializer_class = DosetteCycleSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["administrator", "pharmacist", "dispenser"]
    filterset_fields = ["status", "plan"]
    ordering_fields = ["due_date", "cycle_start"]

    def _get_locked_cycle(self, request, pk):
        queryset = self.filter_queryset(self.get_queryset()).select_for_update()
        cycle = get_object_or_404(queryset, pk=pk)
        self.check_object_permissions(request, cycle)
        return cycle

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def assemble(self, request, pk=None):
        """Dispenser marks a pack assembled (potted)."""
        cycle = self._get_locked_cycle(request, pk)
        if cycle.status not in {
            DosetteCycle.Status.SCHEDULED,
            DosetteCycle.Status.IN_PREP,
        }:
            return Response(
                {"detail": "Only a scheduled or in-preparation pack can be assembled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cycle.status = DosetteCycle.Status.ASSEMBLED
        cycle.assembled_by = request.user
        cycle.save(update_fields=["status", "assembled_by", "updated_at"])
        record("dispense", "dosette.DosetteCycle", entity_id=cycle.id,
               summary=f"Pack assembled for {cycle.plan.patient.patient_id}",
               actor=request.user)
        return Response(self.get_serializer(cycle).data)

    @action(detail=True, methods=["post"], permission_classes=[IsPharmacistOrAdmin])
    @transaction.atomic
    def final_check(self, request, pk=None):
        """Pharmacist's final verification (safety-critical, restricted role)."""
        cycle = self._get_locked_cycle(request, pk)
        if cycle.status != DosetteCycle.Status.ASSEMBLED:
            return Response({"detail": "Pack must be assembled before final check."},
                            status=status.HTTP_400_BAD_REQUEST)
        cycle.status = DosetteCycle.Status.CHECKED
        cycle.checked_by = request.user
        cycle.save(update_fields=["status", "checked_by", "updated_at"])
        record("check", "dosette.DosetteCycle", entity_id=cycle.id,
               summary=f"Final check passed for {cycle.plan.patient.patient_id}",
               actor=request.user)
        return Response(self.get_serializer(cycle).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def seal(self, request, pk=None):
        cycle = self._get_locked_cycle(request, pk)
        if cycle.status != DosetteCycle.Status.CHECKED:
            return Response({"detail": "Pack must pass final check before sealing."},
                            status=status.HTTP_400_BAD_REQUEST)
        cycle.status = DosetteCycle.Status.SEALED
        cycle.sealed_at = timezone.now()
        cycle.save(update_fields=["status", "sealed_at", "updated_at"])
        record("check", "dosette.DosetteCycle", entity_id=cycle.id,
               summary=f"Pack sealed for {cycle.plan.patient.patient_id}",
               actor=request.user)
        return Response(self.get_serializer(cycle).data)
