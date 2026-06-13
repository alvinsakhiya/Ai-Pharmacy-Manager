from rest_framework import viewsets
from accounts.permissions import InventoryRolePermission
from auditlog.services import AuditedModelViewSetMixin
from .models import Medication, StockBatch
from .serializers import MedicationSerializer, StockBatchSerializer


class MedicationViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Medication.objects.all()
    serializer_class = MedicationSerializer
    audit_entity_type = "Medication"
    permission_classes = [InventoryRolePermission]


class StockBatchViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    queryset = StockBatch.objects.select_related("medication").all()
    serializer_class = StockBatchSerializer
    audit_entity_type = "StockBatch"
    permission_classes = [InventoryRolePermission]
