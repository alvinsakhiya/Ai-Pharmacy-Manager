from django.db import transaction
from django.db.models import Q
from rest_framework import pagination, viewsets
from rest_framework.exceptions import ValidationError

from accounts.permissions import DosetteRolePermission
from auditlog.services import AuditedModelViewSetMixin
from .models import DosetteMedicationChange, DosetteRecord
from .serializers import (
    DosetteMedicationChangeSerializer,
    DosetteRecordSerializer,
)
from .services import determine_change_type, record_dosette_change


class DosetteRecordViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = DosetteRecord.objects.select_related(
        "patient",
        "medication"
    ).all()
    serializer_class = DosetteRecordSerializer
    audit_entity_type = "DosetteRecord"
    permission_classes = [DosetteRolePermission]

    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)
            record_dosette_change(
                serializer.instance,
                change_type=DosetteMedicationChange.ChangeType.CREATED,
                changed_fields=serializer.validated_data,
                request=self.request,
            )

    def perform_update(self, serializer):
        changed_fields = sorted(serializer.validated_data)

        with transaction.atomic():
            super().perform_update(serializer)
            record_dosette_change(
                serializer.instance,
                change_type=determine_change_type(
                    serializer.instance,
                    changed_fields,
                ),
                changed_fields=changed_fields,
                request=self.request,
            )

    def perform_destroy(self, instance):
        with transaction.atomic():
            record_dosette_change(
                instance,
                change_type=DosetteMedicationChange.ChangeType.DELETED,
                changed_fields=["record_deleted"],
                request=self.request,
            )
            super().perform_destroy(instance)


class DosetteChangePagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class DosetteMedicationChangeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DosetteMedicationChangeSerializer
    permission_classes = [DosetteRolePermission]
    pagination_class = DosetteChangePagination
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        queryset = DosetteMedicationChange.objects.select_related("actor")
        patient = self.request.query_params.get("patient", "").strip()
        dosette_record = self.request.query_params.get(
            "dosette_record",
            "",
        ).strip()
        change_type = self.request.query_params.get(
            "change_type",
            "",
        ).strip().upper()
        search = self.request.query_params.get("search", "").strip()

        if patient:
            if not patient.isdigit() or int(patient) < 1:
                raise ValidationError(
                    {"patient": "Patient must be a positive integer."}
                )
            queryset = queryset.filter(patient_identifier=int(patient))

        if dosette_record:
            if not dosette_record.isdigit() or int(dosette_record) < 1:
                raise ValidationError(
                    {
                        "dosette_record": (
                            "Dosette record must be a positive integer."
                        )
                    }
                )
            queryset = queryset.filter(
                dosette_record_identifier=int(dosette_record)
            )

        if change_type:
            valid_types = {
                choice.value for choice in DosetteMedicationChange.ChangeType
            }
            if change_type not in valid_types:
                raise ValidationError(
                    {"change_type": "Unknown dosette change type."}
                )
            queryset = queryset.filter(change_type=change_type)

        if search:
            queryset = queryset.filter(
                Q(patient_name__icontains=search)
                | Q(medication_name__icontains=search)
                | Q(actor_username__icontains=search)
            )

        return queryset
