from rest_framework import serializers
from .models import DosetteRecord


class DosetteRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    medication_name = serializers.CharField(source="medication.name", read_only=True)
    medication_strength = serializers.CharField(source="medication.strength", read_only=True)
    medication_form = serializers.CharField(source="medication.form", read_only=True)

    class Meta:
        model = DosetteRecord
        fields = "__all__"

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"