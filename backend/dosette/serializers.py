from rest_framework import serializers
from .models import DosetteMedicationChange, DosetteRecord
from .utils import DOSE_FIELDS, InvalidDoseValue, normalise_dose_value


class DosetteRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    medication_name = serializers.CharField(source="medication.name", read_only=True)
    medication_strength = serializers.CharField(source="medication.strength", read_only=True)
    medication_form = serializers.CharField(source="medication.form", read_only=True)
    patient_care_setting = serializers.CharField(
        source="patient.care_setting",
        read_only=True,
    )
    patient_care_setting_label = serializers.CharField(
        source="patient.get_care_setting_display",
        read_only=True,
    )

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


class DosetteMedicationChangeSerializer(serializers.ModelSerializer):
    actor_display = serializers.SerializerMethodField()
    change_type_label = serializers.CharField(
        source="get_change_type_display",
        read_only=True,
    )

    class Meta:
        model = DosetteMedicationChange
        fields = (
            "id",
            "dosette_record_identifier",
            "patient_identifier",
            "patient_name",
            "medication_identifier",
            "medication_name",
            "change_type",
            "change_type_label",
            "changed_fields",
            "morning_dose",
            "afternoon_dose",
            "evening_dose",
            "bedtime_dose",
            "is_active",
            "cycle_start_date",
            "cycle_length_weeks",
            "review_date",
            "actor_display",
            "timestamp",
        )
        read_only_fields = fields

    def get_actor_display(self, obj):
        return obj.actor_username or "System"
