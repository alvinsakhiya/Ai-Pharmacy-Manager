from typing import Any

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.patients.selectors import patients_for
from apps.tenancy.permissions import Action, require

from .models import PatientMedication
from .serializers import PatientMedicationSerializer


def _audit_metadata(line: PatientMedication) -> dict[str, object]:
    return {
        "pharmacy_id": line.patient.pharmacy_id,
        "patient_id": line.patient_id,
        "patient_reference": line.patient.patient_reference,
        "patient_medication_id": line.id,
        "medication_id": line.medication_id,
        "medication_name": line.medication.name,
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
