from rest_framework import serializers

from .models import PatientMedication


class PatientMedicationSerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source="medication.name", read_only=True)

    class Meta:
        model = PatientMedication
        fields = [
            "id",
            "medication",
            "medication_name",
            "dose_instructions",
            "quantity_morning",
            "quantity_lunchtime",
            "quantity_evening",
            "quantity_bedtime",
            "start_date",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]
        validators: list[object] = []

    def validate(self, attrs):
        patient = self.context["patient"]
        medication = attrs.get("medication", getattr(self.instance, "medication", None))

        if medication is None:
            raise serializers.ValidationError(
                {"medication": ["This field is required."]}
            )

        if self.instance is not None and medication != self.instance.medication:
            raise serializers.ValidationError(
                {
                    "medication": [
                        "Medication cannot be changed; discontinue and add a new line."
                    ]
                }
            )

        if medication.group_id != patient.pharmacy.group_id:
            raise serializers.ValidationError(
                {
                    "medication": [
                        "This medication is not available for this patient's pharmacy "
                        "group."
                    ]
                }
            )

        queryset = PatientMedication.objects.filter(
            patient=patient,
            medication=medication,
            is_active=True,
        )
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                {
                    "medication": [
                        "An active medication line for this medication already exists "
                        "for this patient."
                    ]
                }
            )

        return attrs
