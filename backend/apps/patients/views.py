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

from .models import Patient
from .selectors import patients_for
from .serializers import PatientSerializer


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
                Q(last_name__icontains=search)
                | Q(first_name__icontains=search)
                | Q(patient_reference__icontains=search)
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
