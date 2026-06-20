from typing import Any

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.inventory.models import StockBatch, StockItem
from apps.patients.selectors import patients_for
from apps.tenancy.permissions import Action, require

from .models import CycleStatus, DosetteCycle, PatientMedication
from .serializers import (
    DosetteCycleSerializer,
    PatientMedicationSerializer,
    PickingListSerializer,
    StockPreviewSerializer,
)


def _audit_metadata(line: PatientMedication) -> dict[str, object]:
    return {
        "pharmacy_id": line.patient.pharmacy_id,
        "patient_id": line.patient_id,
        "patient_reference": line.patient.patient_reference,
        "patient_medication_id": line.id,
        "medication_id": line.medication_id,
        "medication_name": line.medication.name,
    }


def _cycle_audit_metadata(cycle: DosetteCycle) -> dict[str, object]:
    return {
        "pharmacy_id": cycle.patient.pharmacy_id,
        "patient_id": cycle.patient_id,
        "patient_reference": cycle.patient.patient_reference,
        "dosette_cycle_id": cycle.id,
        "cycle_reference": cycle.reference,
        "status": cycle.status,
    }


class PatientMedicationMixin:
    serializer_class = PatientMedicationSerializer
    request: Any
    kwargs: dict[str, Any]
    format_kwarg: Any

    def get_permissions(self):
        action = (
            Action.BLISTER_VIEW
            if self.request.method in SAFE_METHODS
            else Action.BLISTER_MANAGE
        )
        return [require(action)()]

    def check_object_permissions(self, request, obj) -> None:
        return None

    def _get_patient(self):
        return get_object_or_404(
            patients_for(self.request.user),
            pk=self.kwargs["patient_pk"],
        )

    def get_queryset(self):
        patient = self._get_patient()
        return (
            PatientMedication.scoped.for_user(self.request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy", "medication")
        )

    def get_serializer_context(self):
        return {
            "request": self.request,
            "format": self.format_kwarg,
            "view": self,
            "patient": self._get_patient(),
        }


class DosetteCycleMixin:
    serializer_class = DosetteCycleSerializer
    request: Any
    kwargs: dict[str, Any]
    format_kwarg: Any

    def get_permissions(self):
        action = (
            Action.BLISTER_VIEW
            if self.request.method in SAFE_METHODS
            else Action.BLISTER_MANAGE
        )
        return [require(action)()]

    def check_object_permissions(self, request, obj) -> None:
        return None

    def _get_patient(self):
        return get_object_or_404(
            patients_for(self.request.user),
            pk=self.kwargs["patient_pk"],
        )

    def get_queryset(self):
        patient = self._get_patient()
        return (
            DosetteCycle.scoped.for_user(self.request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy")
        )

    def get_serializer_context(self):
        return {
            "request": self.request,
            "format": self.format_kwarg,
            "view": self,
            "patient": self._get_patient(),
        }


class DosetteCycleListCreateView(DosetteCycleMixin, ListCreateAPIView):
    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter in CycleStatus.values:
            return queryset.filter(status=status_filter)
        return queryset

    def perform_create(self, serializer):
        patient = self._get_patient()
        with transaction.atomic():
            cycle = serializer.save(patient=patient)
            record(
                action=AuditAction.BLISTER_CYCLE_CREATED,
                actor=self.request.user,
                pharmacy=patient.pharmacy,
                target=cycle,
                request=self.request,
                metadata=_cycle_audit_metadata(cycle),
            )


class DosetteCycleDetailView(DosetteCycleMixin, RetrieveUpdateAPIView):
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        changed_fields = sorted(serializer.validated_data.keys())

        with transaction.atomic():
            cycle = serializer.save()
            metadata = _cycle_audit_metadata(cycle)
            metadata["changed_fields"] = changed_fields
            record(
                action=AuditAction.BLISTER_CYCLE_UPDATED,
                actor=request.user,
                pharmacy=cycle.patient.pharmacy,
                target=cycle,
                request=request,
                metadata=metadata,
            )

        return Response(serializer.data)


class DosetteCyclePrepareView(APIView):
    permission_classes = [require(Action.BLISTER_MARK_PREPARED)]

    def _get_patient(self):
        return get_object_or_404(
            patients_for(self.request.user),
            pk=self.kwargs["patient_pk"],
        )

    def _get_cycle(self, request, patient):
        return get_object_or_404(
            DosetteCycle.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy"),
            pk=self.kwargs["pk"],
        )

    def post(self, request, patient_pk, pk):
        patient = self._get_patient()
        cycle = self._get_cycle(request, patient)

        if cycle.status != CycleStatus.DRAFT:
            return Response(
                {"detail": ["Only draft cycles can be prepared."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            cycle.status = CycleStatus.PREPARED
            cycle.save(update_fields=["status", "updated_at"])
            record(
                action=AuditAction.BLISTER_CYCLE_PREPARED,
                actor=request.user,
                pharmacy=patient.pharmacy,
                target=cycle,
                request=request,
                metadata=_cycle_audit_metadata(cycle),
            )

        return Response(
            DosetteCycleSerializer(
                cycle,
                context={"request": request, "patient": patient},
            ).data,
            status=status.HTTP_200_OK,
        )


class DosetteCycleCancelView(APIView):
    permission_classes = [require(Action.BLISTER_MANAGE)]

    def _get_patient(self):
        return get_object_or_404(
            patients_for(self.request.user),
            pk=self.kwargs["patient_pk"],
        )

    def _get_cycle(self, request, patient):
        return get_object_or_404(
            DosetteCycle.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy"),
            pk=self.kwargs["pk"],
        )

    def post(self, request, patient_pk, pk):
        patient = self._get_patient()
        cycle = self._get_cycle(request, patient)

        if cycle.status not in {CycleStatus.DRAFT, CycleStatus.PREPARED}:
            return Response(
                {"detail": ["Only draft or prepared cycles can be cancelled."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            cycle.status = CycleStatus.CANCELLED
            cycle.save(update_fields=["status", "updated_at"])
            record(
                action=AuditAction.BLISTER_CYCLE_CANCELLED,
                actor=request.user,
                pharmacy=patient.pharmacy,
                target=cycle,
                request=request,
                metadata=_cycle_audit_metadata(cycle),
            )

        return Response(
            DosetteCycleSerializer(
                cycle,
                context={"request": request, "patient": patient},
            ).data,
            status=status.HTTP_200_OK,
        )


class PickingListView(APIView):
    permission_classes = [require(Action.BLISTER_VIEW)]

    def _get_patient(self, request, patient_pk):
        return get_object_or_404(patients_for(request.user), pk=patient_pk)

    def _get_cycle(self, request, patient, cycle_pk):
        return get_object_or_404(
            DosetteCycle.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy"),
            pk=cycle_pk,
        )

    def get(self, request, patient_pk, cycle_pk):
        patient = self._get_patient(request, patient_pk)
        cycle = self._get_cycle(request, patient, cycle_pk)
        totals = {
            "morning": 0,
            "lunchtime": 0,
            "evening": 0,
            "bedtime": 0,
            "total_daily": 0,
        }
        rows = []

        lines = (
            PatientMedication.objects.filter(patient=patient, is_active=True)
            .select_related("medication")
            .order_by("medication__name", "id")
        )
        for line in lines:
            total_daily = (
                line.quantity_morning
                + line.quantity_lunchtime
                + line.quantity_evening
                + line.quantity_bedtime
            )
            rows.append(
                {
                    "medication_id": line.medication_id,
                    "medication_name": line.medication.name,
                    "strength": line.medication.strength,
                    "form": line.medication.form,
                    "quantity_morning": line.quantity_morning,
                    "quantity_lunchtime": line.quantity_lunchtime,
                    "quantity_evening": line.quantity_evening,
                    "quantity_bedtime": line.quantity_bedtime,
                    "total_daily": total_daily,
                }
            )
            totals["morning"] += line.quantity_morning
            totals["lunchtime"] += line.quantity_lunchtime
            totals["evening"] += line.quantity_evening
            totals["bedtime"] += line.quantity_bedtime
            totals["total_daily"] += total_daily

        data = {
            "cycle": {
                "id": cycle.id,
                "reference": cycle.reference,
                "frequency": cycle.frequency,
                "start_date": cycle.start_date,
                "end_date": cycle.end_date,
                "status": cycle.status,
            },
            "patient_reference": patient.patient_reference,
            "medications": rows,
            "totals": totals,
        }
        return Response(PickingListSerializer(data).data, status=status.HTTP_200_OK)


class StockPreviewView(APIView):
    permission_classes = [require(Action.BLISTER_VIEW)]

    def _get_patient(self, request, patient_pk):
        return get_object_or_404(patients_for(request.user), pk=patient_pk)

    def _get_cycle(self, request, patient, cycle_pk):
        return get_object_or_404(
            DosetteCycle.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy"),
            pk=cycle_pk,
        )

    def get(self, request, patient_pk, cycle_pk):
        patient = self._get_patient(request, patient_pk)
        cycle = self._get_cycle(request, patient, cycle_pk)
        today = timezone.now().date()
        totals = {
            "required": 0,
            "available": 0,
            "shortage": 0,
        }
        rows = []

        lines = (
            PatientMedication.scoped.for_user(request.user)
            .filter(patient=patient, is_active=True)
            .select_related("medication")
            .order_by("medication__name", "id")
        )
        for line in lines:
            required_quantity = (
                line.quantity_morning
                + line.quantity_lunchtime
                + line.quantity_evening
                + line.quantity_bedtime
            )
            stock_item = (
                StockItem.scoped.for_user(request.user)
                .filter(
                    pharmacy=patient.pharmacy,
                    medication=line.medication,
                )
                .first()
            )
            batches = StockBatch.objects.none()
            if stock_item is not None:
                batches = (
                    StockBatch.scoped.for_user(request.user)
                    .filter(
                        stock_item=stock_item,
                        is_active=True,
                        quantity__gt=0,
                        expiry_date__gte=today,
                    )
                    .order_by("expiry_date", "id")
                )

            usable_batches = list(batches)
            available_quantity = sum(batch.quantity for batch in usable_batches)
            shortage_quantity = max(0, required_quantity - available_quantity)
            remaining_required = required_quantity
            suggested_batches = []

            for batch in usable_batches:
                quantity_to_pick = min(remaining_required, batch.quantity)
                if quantity_to_pick > 0:
                    suggested_batches.append(
                        {
                            "batch_id": batch.id,
                            "batch_number": batch.batch_number,
                            "expiry_date": batch.expiry_date,
                            "quantity_available": batch.quantity,
                            "quantity_to_pick": quantity_to_pick,
                        }
                    )
                    remaining_required -= quantity_to_pick
                if remaining_required <= 0:
                    break

            rows.append(
                {
                    "medication_id": line.medication_id,
                    "medication_name": line.medication.name,
                    "strength": line.medication.strength,
                    "form": line.medication.form,
                    "required_quantity": required_quantity,
                    "available_quantity": available_quantity,
                    "shortage_quantity": shortage_quantity,
                    "in_stock": shortage_quantity == 0,
                    "earliest_expiry": (
                        usable_batches[0].expiry_date if usable_batches else None
                    ),
                    "suggested_batches": suggested_batches,
                }
            )
            totals["required"] += required_quantity
            totals["available"] += available_quantity
            totals["shortage"] += shortage_quantity

        data = {
            "cycle": {
                "id": cycle.id,
                "reference": cycle.reference,
                "frequency": cycle.frequency,
                "start_date": cycle.start_date,
                "end_date": cycle.end_date,
                "status": cycle.status,
            },
            "patient_reference": patient.patient_reference,
            "pharmacy_id": patient.pharmacy_id,
            "medications": rows,
            "totals": totals,
        }
        return Response(StockPreviewSerializer(data).data, status=status.HTTP_200_OK)


class PatientMedicationListCreateView(PatientMedicationMixin, ListCreateAPIView):
    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get("is_active")
        if is_active in {"true", "1", "yes"}:
            return queryset.filter(is_active=True)
        if is_active in {"false", "0", "no"}:
            return queryset.filter(is_active=False)
        return queryset

    def perform_create(self, serializer):
        patient = self._get_patient()
        with transaction.atomic():
            line = serializer.save(patient=patient)
            record(
                action=AuditAction.BLISTER_MEDICATION_ADDED,
                actor=self.request.user,
                pharmacy=patient.pharmacy,
                target=line,
                request=self.request,
                metadata=_audit_metadata(line),
            )


class PatientMedicationDetailView(PatientMedicationMixin, RetrieveUpdateAPIView):
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        changed_fields = sorted(serializer.validated_data.keys())

        with transaction.atomic():
            line = serializer.save()
            metadata = _audit_metadata(line)
            metadata["changed_fields"] = changed_fields
            record(
                action=AuditAction.BLISTER_MEDICATION_UPDATED,
                actor=request.user,
                pharmacy=line.patient.pharmacy,
                target=line,
                request=request,
                metadata=metadata,
            )

        return Response(serializer.data)


class PatientMedicationDiscontinueView(APIView):
    permission_classes = [require(Action.BLISTER_MANAGE)]

    def _get_patient(self):
        return get_object_or_404(
            patients_for(self.request.user),
            pk=self.kwargs["patient_pk"],
        )

    def post(self, request, patient_pk, pk):
        patient = self._get_patient()
        line = get_object_or_404(
            PatientMedication.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy", "medication"),
            pk=pk,
        )

        if not line.is_active:
            return Response(
                {"detail": ["This medication line is already discontinued."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            line.soft_delete()
            record(
                action=AuditAction.BLISTER_MEDICATION_DISCONTINUED,
                actor=request.user,
                pharmacy=patient.pharmacy,
                target=line,
                request=request,
                metadata=_audit_metadata(line),
            )

        return Response(
            PatientMedicationSerializer(
                line,
                context={"request": request, "patient": patient},
            ).data,
            status=status.HTTP_200_OK,
        )
