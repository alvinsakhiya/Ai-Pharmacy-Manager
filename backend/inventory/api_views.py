from rest_framework import viewsets
from .models import Medication, StockBatch
from .serializers import MedicationSerializer, StockBatchSerializer


class MedicationViewSet(viewsets.ModelViewSet):
    queryset = Medication.objects.all()
    serializer_class = MedicationSerializer


class StockBatchViewSet(viewsets.ModelViewSet):
    queryset = StockBatch.objects.select_related("medication").all()
    serializer_class = StockBatchSerializer