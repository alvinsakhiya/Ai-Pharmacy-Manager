from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.tenancy.permissions import Action, require

from .crypto import blind_index
from .models import Patient, PatientGp
from .selectors import patients_for
from .serializers import (
    PatientGpSerializer,
    PatientNoteSerializer,
    PatientSerializer,
)


def _audit_metadata(patient: Patient) -> dict[str, object]:
    return {
        "pharmacy_id": patient.pharmacy_id,
        "patient_id": patient.id,
        "patient_reference": patient.patient_reference,
    }


class PatientListCreateView(ListCreateAPIView):
    serializer_class = PatientSerializer

    def get_permissions(self):
        action = (
            Action.PATIENT_VIEW
            if self.request.method in SAFE_METHODS
            else Action.PATIENT_MANAGE
        )
        return [require(action)()]

    def get_queryset(self):
        queryset = patients_for(self.request.user)

        pharmacy_id = self.request.query_params.get("pharmacy")
        if pharmacy_id is not None:
            try:
                pharmacy_id_int = int(pharmacy_id)
            except ValueError:
                return queryset.none()
            queryset = queryset.filter(pharmacy_id=pharmacy_id_int)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(patient_reference__icontains=search)
                | Q(last_name_index=blind_index(search))
            )

        return queryset

    def perform_create(self, serializer):
        with transaction.atomic():
            patient = serializer.save()
            record(
                action=AuditAction.PATIENT_CREATED,
                actor=self.request.user,
                pharmacy=patient.pharmacy,
                target=patient,
                request=self.request,
                metadata=_audit_metadata(patient),
            )


class PatientDetailView(RetrieveUpdateAPIView):
    serializer_class = PatientSerializer

    def get_permissions(self):
        action = (
            Action.PATIENT_VIEW
            if self.request.method in SAFE_METHODS
            else Action.PATIENT_MANAGE
        )
        return [require(action)()]

    def get_queryset(self):
        return patients_for(self.request.user)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        changed_fields = sorted(serializer.validated_data.keys())

        with transaction.atomic():
            patient = serializer.save()
            metadata = _audit_metadata(patient)
            metadata["changed_fields"] = changed_fields
            record(
                action=AuditAction.PATIENT_UPDATED,
                actor=request.user,
                pharmacy=patient.pharmacy,
                target=patient,
                request=request,
                metadata=metadata,
            )

        return Response(serializer.data)


class PatientDeactivateView(APIView):
    permission_classes = [require(Action.PATIENT_MANAGE)]

    def post(self, request, pk):
        patient = get_object_or_404(patients_for(request.user), pk=pk)
        with transaction.atomic():
            patient.soft_delete()
            record(
                action=AuditAction.PATIENT_DEACTIVATED,
                actor=request.user,
                pharmacy=patient.pharmacy,
                target=patient,
                request=request,
                metadata=_audit_metadata(patient),
            )
        return Response(
            PatientSerializer(patient, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class PatientGpView(APIView):
    """Doctor / GP details for a patient. View with PATIENT_VIEW, edit with
    PATIENT_MANAGE. Returns empty defaults when no GP record exists yet."""

    def get_permissions(self):
        action = (
            Action.PATIENT_VIEW
            if self.request.method in SAFE_METHODS
            else Action.PATIENT_MANAGE
        )
        return [require(action)()]

    def _get_patient(self, request, pk) -> Patient:
        return get_object_or_404(patients_for(request.user), pk=pk)

    def get(self, request, pk):
        patient = self._get_patient(request, pk)
        gp = PatientGp.objects.filter(patient=patient).first() or PatientGp(
            patient=patient
        )
        return Response(PatientGpSerializer(gp).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, *, partial: bool):
        patient = self._get_patient(request, pk)
        serializer = PatientGpSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        changed_fields = sorted(serializer.validated_data.keys())

        with transaction.atomic():
            gp, _ = PatientGp.objects.get_or_create(patient=patient)
            for field, value in serializer.validated_data.items():
                setattr(gp, field, value)
            gp.save()
            metadata = _audit_metadata(patient)
            metadata["section"] = "gp"
            metadata["changed_fields"] = changed_fields
            record(
                action=AuditAction.PATIENT_UPDATED,
                actor=request.user,
                pharmacy=patient.pharmacy,
                target=patient,
                request=request,
                metadata=metadata,
            )

        return Response(PatientGpSerializer(gp).data)


class PatientNoteListCreateView(ListCreateAPIView):
    serializer_class = PatientNoteSerializer

    def get_permissions(self):
        action = (
            Action.PATIENT_VIEW
            if self.request.method in SAFE_METHODS
            else Action.PATIENT_MANAGE
        )
        return [require(action)()]

    def _get_patient(self):
        return get_object_or_404(
            patients_for(self.request.user),
            pk=self.kwargs["pk"],
        )

    def get_queryset(self):
        return self._get_patient().history_notes.all()

    def perform_create(self, serializer):
        patient = self._get_patient()
        with transaction.atomic():
            note = serializer.save(
                patient=patient,
                author=self.request.user,
                author_email=getattr(self.request.user, "email", "") or "",
            )
            record(
                action=AuditAction.PATIENT_NOTE_ADDED,
                actor=self.request.user,
                pharmacy=patient.pharmacy,
                target=note,
                request=self.request,
                metadata={
                    "pharmacy_id": patient.pharmacy_id,
                    "patient_id": patient.id,
                    "patient_reference": patient.patient_reference,
                    "note_id": note.id,
                },
            )
