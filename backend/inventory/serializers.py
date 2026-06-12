from rest_framework import serializers
from .models import Medication, StockBatch


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = "__all__"


class StockBatchSerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source="medication.name", read_only=True)
    medication_strength = serializers.CharField(source="medication.strength", read_only=True)
    medication_form = serializers.CharField(source="medication.form", read_only=True)

    class Meta:
        model = StockBatch
        fields = "__all__"