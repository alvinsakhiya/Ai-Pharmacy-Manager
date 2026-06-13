from rest_framework import viewsets

from apps.core.audit import record
from apps.core.permissions import RolePermission

from .models import Patient, PatientNote
from .serializers import (
    PatientDetailSerializer,
    PatientNoteSerializer,
    PatientSerializer,
)


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    permission_classes = [RolePermission]
    # Dispensers can read; pharmacists/admins can edit records.
    allowed_roles = ["pharmacist", "administrator"]
    filterset_fields = ["status", "is_dosette"]
    search_fields = ["patient_id", "first_name", "last_name", "postcode"]
    ordering_fields = ["last_name", "created_at", "patient_id"]

    def get_serializer_class(self):
        return PatientDetailSerializer if self.action == "retrieve" else PatientSerializer

    def perform_create(self, serializer):
        obj = serializer.save()
        record("create", "patients.Patient", entity_id=obj.id,
               summary=f"Created patient {obj.patient_id}")

    def perform_update(self, serializer):
        obj = serializer.save()
        record("update", "patients.Patient", entity_id=obj.id,
               summary=f"Updated patient {obj.patient_id}")


class PatientNoteViewSet(viewsets.ModelViewSet):
    queryset = PatientNote.objects.select_related("author", "patient")
    serializer_class = PatientNoteSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["pharmacist", "administrator", "dispenser"]
    filterset_fields = ["patient", "category"]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
