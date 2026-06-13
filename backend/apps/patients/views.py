from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.audit import record
from apps.core.permissions import IsAdministrator, RolePermission

from .models import Patient, PatientNote
from .serializers import (
    PatientDetailSerializer,
    PatientNoteSerializer,
    PatientSearchQuerySerializer,
    PatientSearchSerializer,
    PatientSerializer,
)


class PatientViewSet(viewsets.ModelViewSet):
    permission_classes = [RolePermission]
    allowed_roles = ["pharmacist", "administrator"]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    filterset_fields = ["status", "is_dosette"]
    search_fields = ["patient_id", "first_name", "last_name", "postcode"]
    ordering_fields = ["last_name", "created_at", "patient_id"]

    def get_queryset(self):
        return Patient.objects.annotate(
            _active_dosette_count=Count(
                "dosette_plans",
                filter=Q(dosette_plans__is_active=True),
            )
        ).order_by("last_name", "first_name", "patient_id")

    def get_permissions(self):
        if self.action == "list":
            return [IsAdministrator()]
        return super().get_permissions()

    def get_serializer_class(self):
        return PatientDetailSerializer if self.action == "retrieve" else PatientSerializer

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Limited patient lookup available to all authenticated pharmacy roles."""
        query = PatientSearchQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        term = query.validated_data["q"]
        results = self.get_queryset().filter(
            Q(patient_id__icontains=term)
            | Q(first_name__icontains=term)
            | Q(last_name__icontains=term)
            | Q(postcode__icontains=term)
        ).order_by("last_name", "first_name")[:20]
        return Response(PatientSearchSerializer(results, many=True).data)

    def perform_create(self, serializer):
        obj = serializer.save()
        record("create", "patients.Patient", entity_id=obj.id,
               summary=f"Created patient {obj.patient_id}",
               actor=self.request.user)

    def perform_update(self, serializer):
        obj = serializer.save()
        record("update", "patients.Patient", entity_id=obj.id,
               summary=f"Updated patient {obj.patient_id}",
               actor=self.request.user)


class PatientNoteViewSet(viewsets.ModelViewSet):
    queryset = PatientNote.objects.select_related("author", "patient")
    serializer_class = PatientNoteSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["pharmacist", "administrator", "dispenser"]
    filterset_fields = ["patient", "category"]

    def perform_create(self, serializer):
        note = serializer.save(author=self.request.user)
        record(
            "create",
            "patients.PatientNote",
            entity_id=note.id,
            summary=f"Added {note.category} note to {note.patient.patient_id}",
            actor=self.request.user,
        )
