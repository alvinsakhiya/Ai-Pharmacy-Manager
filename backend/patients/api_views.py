from rest_framework import viewsets
from accounts.permissions import PatientRolePermission
from auditlog.services import AuditedModelViewSetMixin
from .models import Patient
from .serializers import PatientSerializer


class PatientViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    audit_entity_type = "Patient"
    permission_classes = [PatientRolePermission]
