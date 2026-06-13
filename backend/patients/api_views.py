from django.db.models import Q
from rest_framework import pagination, viewsets
from rest_framework.exceptions import ValidationError

from accounts.permissions import (
    ClinicalReviewRolePermission,
    PatientRolePermission,
)
from auditlog.services import AuditedModelViewSetMixin
from .models import ClinicalReviewNote, Patient
from .serializers import ClinicalReviewNoteSerializer, PatientSerializer


class PatientViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    audit_entity_type = "Patient"
    permission_classes = [PatientRolePermission]


class ClinicalReviewPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class ClinicalReviewNoteViewSet(
    AuditedModelViewSetMixin,
    viewsets.ModelViewSet,
):
    serializer_class = ClinicalReviewNoteSerializer
    permission_classes = [ClinicalReviewRolePermission]
    pagination_class = ClinicalReviewPagination
    audit_entity_type = "ClinicalReviewNote"

    def get_queryset(self):
        queryset = ClinicalReviewNote.objects.select_related(
            "patient",
            "author",
        )
        patient_id = self.request.query_params.get("patient", "").strip()
        category = self.request.query_params.get("category", "").strip().upper()
        follow_up_status = self.request.query_params.get(
            "follow_up_status",
            "",
        ).strip().upper()
        search = self.request.query_params.get("search", "").strip()

        if patient_id:
            if not patient_id.isdigit() or int(patient_id) < 1:
                raise ValidationError(
                    {"patient": "Patient must be a positive integer."}
                )
            queryset = queryset.filter(patient_id=int(patient_id))

        if category:
            valid_categories = {
                choice.value for choice in ClinicalReviewNote.Category
            }
            if category not in valid_categories:
                raise ValidationError({"category": "Unknown review category."})
            queryset = queryset.filter(category=category)

        if follow_up_status:
            valid_statuses = {
                choice.value
                for choice in ClinicalReviewNote.FollowUpStatus
            }
            if follow_up_status not in valid_statuses:
                raise ValidationError(
                    {"follow_up_status": "Unknown follow-up status."}
                )
            queryset = queryset.filter(follow_up_status=follow_up_status)

        if search:
            queryset = queryset.filter(
                Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(note_text__icontains=search)
                | Q(author_username__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        author = self.request.user
        serializer.validated_data["author"] = author
        serializer.validated_data["author_username"] = author.get_username()
        super().perform_create(serializer)
