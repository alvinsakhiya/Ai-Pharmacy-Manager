from typing import Any, TypedDict

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.inventory.models import StockBatch, StockItem
from apps.patients.selectors import patients_for
from apps.tenancy.permissions import Action, can, require

from .models import CycleStatus, DosetteCycle, DosettePeriod, PatientMedication
from .serializers import (
    DosetteCycleSerializer,
    DosetteDeductionSummarySerializer,
    DosettePeriodCollectSerializer,
    DosettePeriodSerializer,
    DosettePeriodSubmitSerializer,
    PatientMedicationSerializer,
    PickingListSerializer,
    StockPreviewSerializer,
)
from .services import (
    DosetteDeductionStatusError,
    DosettePeriodValidationError,
    DosetteStockAlreadyDeducted,
    InsufficientDosetteStock,
    InvalidDosetteCycleDates,
    deduct_dosette_stock,
    plan_dosette_stock,
    record_dosette_period_collection,
    submit_dosette_period,
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
    # Annotated to match GenericAPIView's declaration so the mixin is
    # type-compatible in multiple inheritance; value is unchanged.
    serializer_class: type[BaseSerializer[Any]] | None = PatientMedicationSerializer
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
    # Annotated to match GenericAPIView's declaration so the mixin is
    # type-compatible in multiple inheritance; value is unchanged.
    serializer_class: type[BaseSerializer[Any]] | None = DosetteCycleSerializer
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


class DosettePeriodMixin:
    # Annotated to match GenericAPIView's declaration so the mixin is
    # type-compatible in multiple inheritance; value is unchanged.
    serializer_class: type[BaseSerializer[Any]] | None = DosettePeriodSerializer
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
            DosettePeriod.scoped.for_user(self.request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy")
            .prefetch_related("cycles")
        )

    def get_serializer_context(self):
        return {
            "request": self.request,
            "format": self.format_kwarg,
            "view": self,
            "patient": self._get_patient(),
        }


class DosettePeriodListCreateView(DosettePeriodMixin, ListCreateAPIView):
    def create(self, request, *args, **kwargs):
        patient = self._get_patient()
        serializer = DosettePeriodSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            period = submit_dosette_period(
                actor=request.user,
                patient=patient,
                start_date=serializer.validated_data.get("start_date"),
                request=request,
            )
        except DosettePeriodValidationError as exc:
            raise serializers.ValidationError(exc.detail) from exc

        return Response(
            DosettePeriodSerializer(
                period,
                context={"request": request, "patient": patient},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class DosettePeriodCollectedView(APIView):
    permission_classes = [require(Action.BLISTER_MANAGE)]

    def _get_patient(self, request, patient_pk):
        return get_object_or_404(patients_for(request.user), pk=patient_pk)

    def _get_period(self, request, patient, period_pk):
        return get_object_or_404(
            DosettePeriod.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy")
            .prefetch_related("cycles"),
            pk=period_pk,
        )

    def post(self, request, patient_pk, period_pk):
        patient = self._get_patient(request, patient_pk)
        period = self._get_period(request, patient, period_pk)
        serializer = DosettePeriodCollectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            period = record_dosette_period_collection(
                actor=request.user,
                period=period,
                collected_on=serializer.validated_data.get("collected_on"),
                request=request,
            )
        except DosettePeriodValidationError as exc:
            raise serializers.ValidationError(exc.detail) from exc

        return Response(
            DosettePeriodSerializer(
                period,
                context={"request": request, "patient": patient},
            ).data,
            status=status.HTTP_200_OK,
        )


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

        if cycle.status not in {CycleStatus.DRAFT, CycleStatus.NEEDS_CHANGES}:
            return Response(
                {"detail": ["Only draft or needs changes cycles can be prepared."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            cycle.status = CycleStatus.PREPARED
            cycle.prepared_by = request.user
            cycle.prepared_at = timezone.now()
            cycle.save(
                update_fields=[
                    "status",
                    "prepared_by",
                    "prepared_at",
                    "updated_at",
                ]
            )
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

        if cycle.stock_deducted:
            return Response(
                {"detail": ["Cannot cancel a cycle after stock has been deducted."]},
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


# Pack lifecycle transitions handled by the generic status endpoint. "prepared"
# stays on its own pharmacist-only endpoint; "checked" is pharmacist-only here.
# collected / delivered / needs_changes are operational and dispenser-allowed.
class _StatusRule(TypedDict):
    allowed_from: set[str]
    action: Action


_STATUS_RULES: dict[str, _StatusRule] = {
    "CHECKED": {
        "allowed_from": {"PREPARED"},
        "action": Action.BLISTER_MARK_PREPARED,
    },
    "COLLECTED": {
        "allowed_from": {"CHECKED", "PREPARED"},
        "action": Action.BLISTER_MARK_STATUS,
    },
    "DELIVERED": {
        "allowed_from": {"COLLECTED", "CHECKED"},
        "action": Action.BLISTER_MARK_STATUS,
    },
    "NEEDS_CHANGES": {
        "allowed_from": {"DRAFT", "PREPARED", "CHECKED", "NEEDS_CHANGES"},
        "action": Action.BLISTER_MARK_STATUS,
    },
}


class DosetteCycleStatusView(APIView):
    """Move a cycle along its lifecycle (checked / collected / delivered /
    needs changes). Capability depends on the target status: 'checked' is
    pharmacist-only; the rest are dispenser-allowed."""

    permission_classes = [require(Action.BLISTER_VIEW)]

    def _get_patient(self, request, patient_pk):
        return get_object_or_404(patients_for(request.user), pk=patient_pk)

    def _get_cycle(self, request, patient, pk):
        return get_object_or_404(
            DosetteCycle.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy"),
            pk=pk,
        )

    def post(self, request, patient_pk, pk):
        patient = self._get_patient(request, patient_pk)
        cycle = self._get_cycle(request, patient, pk)

        target = request.data.get("status")
        rule = _STATUS_RULES.get(target)
        if rule is None:
            return Response(
                {
                    "status": [
                        "Unsupported status. Use checked, collected, delivered, "
                        "or needs_changes."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not can(request.user, rule["action"]):
            return Response(
                {"detail": ["You do not have permission to set this status."]},
                status=status.HTTP_403_FORBIDDEN,
            )

        if cycle.status not in rule["allowed_from"]:
            return Response(
                {
                    "detail": [
                        f"Cannot move a {cycle.status} pack to {target}.",
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target == "NEEDS_CHANGES" and cycle.stock_deducted:
            return Response(
                {
                    "detail": [
                        "Stock has already been deducted for this cycle, so it "
                        "cannot be marked as needs changes."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        update_fields = ["status", "updated_at"]
        with transaction.atomic():
            cycle.status = target
            if target == "CHECKED":
                cycle.checked_by = request.user
                cycle.checked_at = timezone.now()
                update_fields += ["checked_by", "checked_at"]
            if target == "NEEDS_CHANGES":
                cycle.prepared_by = None
                cycle.prepared_at = None
                cycle.checked_by = None
                cycle.checked_at = None
                update_fields += [
                    "prepared_by",
                    "prepared_at",
                    "checked_by",
                    "checked_at",
                ]
            cycle.save(update_fields=update_fields)
            metadata = _cycle_audit_metadata(cycle)
            metadata["new_status"] = target
            record(
                action=AuditAction.BLISTER_CYCLE_UPDATED,
                actor=request.user,
                pharmacy=patient.pharmacy,
                target=cycle,
                request=request,
                metadata=metadata,
            )

        return Response(
            DosetteCycleSerializer(
                cycle,
                context={"request": request, "patient": patient},
            ).data,
            status=status.HTTP_200_OK,
        )


class PatientMedicationAppearanceView(APIView):
    """Dispenser-editable colour/shape for the printed pack label. Pharmacists
    can also edit these via the full medication update."""

    permission_classes = [require(Action.BLISTER_VIEW)]

    def patch(self, request, patient_pk, pk):
        if not can(request.user, Action.BLISTER_MARK_STATUS):
            return Response(
                {"detail": ["You do not have permission to edit label appearance."]},
                status=status.HTTP_403_FORBIDDEN,
            )

        patient = get_object_or_404(patients_for(request.user), pk=patient_pk)
        line = get_object_or_404(
            PatientMedication.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy", "medication"),
            pk=pk,
        )

        changed_fields = []
        for field in ("colour", "shape"):
            if field in request.data:
                setattr(line, field, str(request.data[field])[:64])
                changed_fields.append(field)

        if changed_fields:
            with transaction.atomic():
                line.save(update_fields=[*changed_fields, "updated_at"])
                metadata = _audit_metadata(line)
                metadata["changed_fields"] = changed_fields
                record(
                    action=AuditAction.BLISTER_MEDICATION_UPDATED,
                    actor=request.user,
                    pharmacy=patient.pharmacy,
                    target=line,
                    request=request,
                    metadata=metadata,
                )

        return Response(
            PatientMedicationSerializer(
                line,
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
                    "colour": line.colour,
                    "shape": line.shape,
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
        rows = []

        lines = (
            PatientMedication.scoped.for_user(request.user)
            .filter(patient=patient, is_active=True)
            .select_related(
                "medication",
                "medication__group",
                "medication__catalogue_product",
            )
            .order_by("medication__name", "id")
        )
        allocation_plan, _shortages, totals = plan_dosette_stock(
            lines=lines,
            pharmacy=patient.pharmacy,
            stock_items=StockItem.scoped.for_user(request.user),
            stock_batches=StockBatch.scoped.for_user(request.user),
            quantity_multiplier=1,
        )
        for planned_line in allocation_plan:
            line = planned_line.line
            suggested_batches = [
                {
                    "batch_id": allocation.batch.id,
                    "batch_number": allocation.batch.batch_number,
                    "expiry_date": allocation.batch.expiry_date,
                    "quantity_available": allocation.available_quantity,
                    "quantity_to_pick": allocation.quantity,
                }
                for allocation in planned_line.allocations
            ]
            rows.append(
                {
                    "medication_id": line.medication_id,
                    "medication_name": line.medication.name,
                    "strength": line.medication.strength,
                    "form": line.medication.form,
                    "required_quantity": planned_line.required_quantity,
                    "available_quantity": planned_line.available_quantity,
                    "shortage_quantity": planned_line.shortage_quantity,
                    "in_stock": planned_line.shortage_quantity == 0,
                    "earliest_expiry": (
                        planned_line.allocations[0].batch.expiry_date
                        if planned_line.allocations
                        else None
                    ),
                    "suggested_batches": suggested_batches,
                }
            )

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


class DosetteCycleDeductStockView(APIView):
    permission_classes = [require(Action.BLISTER_DEDUCT)]

    def _get_patient(self, request, patient_pk):
        return get_object_or_404(patients_for(request.user), pk=patient_pk)

    def _get_cycle(self, request, patient, cycle_pk):
        return get_object_or_404(
            DosetteCycle.scoped.for_user(request.user)
            .filter(patient=patient)
            .select_related("patient", "patient__pharmacy"),
            pk=cycle_pk,
        )

    def post(self, request, patient_pk, cycle_pk):
        patient = self._get_patient(request, patient_pk)
        cycle = self._get_cycle(request, patient, cycle_pk)

        try:
            summary = deduct_dosette_stock(
                actor=request.user,
                cycle=cycle,
                request=request,
            )
        except (DosetteDeductionStatusError, InvalidDosetteCycleDates) as exc:
            return Response(
                {"detail": exc.detail},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except InsufficientDosetteStock as exc:
            return Response(
                {"detail": exc.detail, "shortages": exc.shortages},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DosetteStockAlreadyDeducted as exc:
            deducted_at = serializers.DateTimeField().to_representation(exc.deducted_at)
            return Response(
                {"detail": exc.detail, "deducted_at": deducted_at},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            DosetteDeductionSummarySerializer(summary).data,
            status=status.HTTP_200_OK,
        )


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
