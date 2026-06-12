from rest_framework import serializers
from .models import DosetteRecord
from .utils import DOSE_FIELDS, InvalidDoseValue, normalise_dose_value


class DosetteRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    medication_name = serializers.CharField(source="medication.name", read_only=True)
    medication_strength = serializers.CharField(source="medication.strength", read_only=True)
    medication_form = serializers.CharField(source="medication.form", read_only=True)

    class Meta:
        model = DosetteRecord
        fields = "__all__"

    def validate(self, attrs):
        errors = {}

        for field_name in DOSE_FIELDS:
            if field_name not in attrs:
                continue

            value = attrs[field_name]

            try:
                normalise_dose_value(value, field_name)
            except InvalidDoseValue as exc:
                errors[field_name] = str(exc)
            else:
                if isinstance(value, str):
                    attrs[field_name] = value.strip()

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"
