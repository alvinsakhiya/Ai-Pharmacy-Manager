from rest_framework import serializers

from .models import DosetteCycle, PatientMedication


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


class DosetteCycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DosetteCycle
        fields = [
            "id",
            "reference",
            "frequency",
            "start_date",
            "end_date",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]
        validators: list[object] = []

    def validate(self, attrs):
        patient = self.context["patient"]
        start_date = attrs.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        reference = attrs.get(
            "reference",
            getattr(self.instance, "reference", None),
        )

        if start_date is not None and end_date is not None and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": ["End date cannot be before the start date."]}
            )

        if reference:
            queryset = DosetteCycle.objects.filter(patient=patient, reference=reference)
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "reference": [
                            "A cycle with this reference already exists for this "
                            "patient."
                        ]
                    }
                )

        return attrs


class PickingListRowSerializer(serializers.Serializer):
    medication_id = serializers.IntegerField(read_only=True)
    medication_name = serializers.CharField(read_only=True)
    strength = serializers.CharField(read_only=True)
    form = serializers.CharField(read_only=True)
    quantity_morning = serializers.IntegerField(read_only=True)
    quantity_lunchtime = serializers.IntegerField(read_only=True)
    quantity_evening = serializers.IntegerField(read_only=True)
    quantity_bedtime = serializers.IntegerField(read_only=True)
    total_daily = serializers.IntegerField(read_only=True)


class _PickingListCycleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    reference = serializers.CharField(read_only=True)
    frequency = serializers.CharField(read_only=True)
    start_date = serializers.DateField(read_only=True)
    end_date = serializers.DateField(read_only=True)
    status = serializers.CharField(read_only=True)


class _PickingListTotalsSerializer(serializers.Serializer):
    morning = serializers.IntegerField(read_only=True)
    lunchtime = serializers.IntegerField(read_only=True)
    evening = serializers.IntegerField(read_only=True)
    bedtime = serializers.IntegerField(read_only=True)
    total_daily = serializers.IntegerField(read_only=True)


class PickingListSerializer(serializers.Serializer):
    cycle = _PickingListCycleSerializer(read_only=True)
    patient_reference = serializers.CharField(read_only=True)
    medications = PickingListRowSerializer(many=True, read_only=True)
    totals = _PickingListTotalsSerializer(read_only=True)


class StockPreviewBatchSerializer(serializers.Serializer):
    batch_id = serializers.IntegerField(read_only=True)
    batch_number = serializers.CharField(read_only=True)
    expiry_date = serializers.DateField(read_only=True)
    quantity_available = serializers.IntegerField(read_only=True)
    quantity_to_pick = serializers.IntegerField(read_only=True)


class StockPreviewRowSerializer(serializers.Serializer):
    medication_id = serializers.IntegerField(read_only=True)
    medication_name = serializers.CharField(read_only=True)
    strength = serializers.CharField(read_only=True)
    form = serializers.CharField(read_only=True)
    required_quantity = serializers.IntegerField(read_only=True)
    available_quantity = serializers.IntegerField(read_only=True)
    shortage_quantity = serializers.IntegerField(read_only=True)
    in_stock = serializers.BooleanField(read_only=True)
    earliest_expiry = serializers.DateField(allow_null=True, read_only=True)
    suggested_batches = StockPreviewBatchSerializer(many=True, read_only=True)


class _StockPreviewTotalsSerializer(serializers.Serializer):
    required = serializers.IntegerField(read_only=True)
    available = serializers.IntegerField(read_only=True)
    shortage = serializers.IntegerField(read_only=True)


class StockPreviewSerializer(serializers.Serializer):
    cycle = _PickingListCycleSerializer(read_only=True)
    patient_reference = serializers.CharField(read_only=True)
    pharmacy_id = serializers.IntegerField(read_only=True)
    medications = StockPreviewRowSerializer(many=True, read_only=True)
    totals = _StockPreviewTotalsSerializer(read_only=True)
