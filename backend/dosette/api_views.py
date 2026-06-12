from rest_framework import viewsets
from .models import DosetteRecord
from .serializers import DosetteRecordSerializer


class DosetteRecordViewSet(viewsets.ModelViewSet):
    queryset = DosetteRecord.objects.select_related(
        "patient",
        "medication"
    ).all()
    serializer_class = DosetteRecordSerializer