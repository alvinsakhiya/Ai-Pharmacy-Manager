from rest_framework import viewsets
from accounts.permissions import DosetteRolePermission
from auditlog.services import AuditedModelViewSetMixin
from .models import DosetteRecord
from .serializers import DosetteRecordSerializer


class DosetteRecordViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = DosetteRecord.objects.select_related(
        "patient",
        "medication"
    ).all()
    serializer_class = DosetteRecordSerializer
    audit_entity_type = "DosetteRecord"
    permission_classes = [DosetteRolePermission]
