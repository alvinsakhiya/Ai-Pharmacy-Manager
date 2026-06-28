from datetime import date

from django.utils import timezone
from rest_framework import serializers

from apps.catalogue.models import CatalogueProduct
from apps.catalogue.services import get_or_create_medication_from_product

from .models import (
    CycleFrequency,
    CycleStatus,
    DosetteCycle,
    DosettePeriod,
    PatientMedication,
)

PREPARE_SOON_DAYS = 3
SUPPLY_PERIOD_LABELS = {
    CycleFrequency.WEEKLY: "1-week supply",
    CycleFrequency.FORTNIGHTLY: "2-week supply",
    CycleFrequency.FOUR_WEEKLY: "4-week supply",
    CycleFrequency.MONTHLY: "Monthly supply",
}
CLOSED_CYCLE_STATUSES = {
    CycleStatus.CANCELLED,
    CycleStatus.COLLECTED,
    CycleStatus.DELIVERED,
    CycleStatus.COMPLETED,
}


def format_cycle_date(value: date) -> str:
    return value.strftime("%d %b %Y")


class PatientMedicationSerializer(serializers.ModelSerializer):
    catalogue_product = serializers.PrimaryKeyRelatedField(
        queryset=CatalogueProduct.objects.filter(is_active=True),
        required=False,
        write_only=True,
    )
    medication_name = serializers.CharField(source="medication.name", read_only=True)
    strength = serializers.CharField(source="medication.strength", read_only=True)
    form = serializers.CharField(source="medication.form", read_only=True)

    class Meta:
        model = PatientMedication
        fields = [
            "id",
            "medication",
            "catalogue_product",
            "medication_name",
            "strength",
            "form",
            "dose_instructions",
            "quantity_morning",
            "quantity_lunchtime",
            "quantity_evening",
            "quantity_bedtime",
            "start_date",
            "colour",
            "shape",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]
        validators: list[object] = []
        extra_kwargs = {
            "medication": {"required": False},
        }

    def _validate_medication_for_patient(self, medication, patient) -> None:
        if medication is None:
            raise serializers.ValidationError(
                {"medication": ["This field is required."]}
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

    def validate(self, attrs):
        patient = self.context["patient"]
        catalogue_product = attrs.get("catalogue_product")
        medication = attrs.get("medication", getattr(self.instance, "medication", None))

        if catalogue_product is not None and "medication" in attrs:
            raise serializers.ValidationError(
                {
                    "catalogue_product": [
                        "Provide either catalogue_product or medication, not both."
                    ]
                }
            )

        if self.instance is None and catalogue_product is None and medication is None:
            raise serializers.ValidationError(
                {"medication": ["This field is required."]}
            )

        if self.instance is not None and catalogue_product is not None:
            existing_product_id = self.instance.medication.catalogue_product_id
            if existing_product_id != catalogue_product.id:
                raise serializers.ValidationError(
                    {
                        "medication": [
                            "Medication cannot be changed; discontinue and add a new "
                            "line."
                        ]
                    }
                )

        if self.instance is not None and "medication" in attrs:
            if medication != self.instance.medication:
                raise serializers.ValidationError(
                    {
                        "medication": [
                            "Medication cannot be changed; discontinue and add a new "
                            "line."
                        ]
                    }
                )

        if catalogue_product is None:
            self._validate_medication_for_patient(medication, patient)

        return attrs

    def create(self, validated_data):
        catalogue_product = validated_data.pop("catalogue_product", None)
        if catalogue_product is not None:
            patient = validated_data["patient"]
            medication = get_or_create_medication_from_product(
                patient.pharmacy.group,
                catalogue_product,
            )
            self._validate_medication_for_patient(medication, patient)
            validated_data["medication"] = medication

        return super().create(validated_data)

    def update(self, instance, validated_data):
        catalogue_product = validated_data.pop("catalogue_product", None)
        if catalogue_product is not None:
            medication = get_or_create_medication_from_product(
                instance.patient.pharmacy.group,
                catalogue_product,
            )
            if medication != instance.medication:
                raise serializers.ValidationError(
                    {
                        "medication": [
                            "Medication cannot be changed; discontinue and add a new "
                            "line."
                        ]
                    }
                )

        return super().update(instance, validated_data)

    def validate_medication(self, value):
        if self.instance is not None and value != self.instance.medication:
            raise serializers.ValidationError(
                "Medication cannot be changed; discontinue and add a new line."
            )
        return value


class DosetteCycleSerializer(serializers.ModelSerializer):
    patient_reference = serializers.CharField(
        source="patient.patient_reference",
        read_only=True,
    )
    supply_period_label = serializers.SerializerMethodField()
    display_label = serializers.SerializerMethodField()
    due_status = serializers.SerializerMethodField()
    days_until_due = serializers.SerializerMethodField()
    is_due_soon = serializers.SerializerMethodField()
    prepared_by_email = serializers.SerializerMethodField()
    checked_by_email = serializers.SerializerMethodField()

    class Meta:
        model = DosetteCycle
        fields = [
            "id",
            "reference",
            "patient_reference",
            "display_label",
            "supply_period_label",
            "frequency",
            "start_date",
            "end_date",
            "due_status",
            "days_until_due",
            "is_due_soon",
            "status",
            "stock_deducted",
            "deducted_at",
            "prepared_by_email",
            "prepared_at",
            "checked_by_email",
            "checked_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "patient_reference",
            "display_label",
            "supply_period_label",
            "due_status",
            "days_until_due",
            "is_due_soon",
            "status",
            "stock_deducted",
            "deducted_at",
            "prepared_at",
            "checked_at",
            "created_at",
            "updated_at",
        ]
        validators: list[object] = []

    def get_supply_period_label(self, obj: DosetteCycle) -> str:
        return SUPPLY_PERIOD_LABELS.get(
            obj.frequency,
            str(obj.frequency).replace("_", " ").title(),
        )

    def get_display_label(self, obj: DosetteCycle) -> str:
        date_range = (
            f"{format_cycle_date(obj.start_date)} - {format_cycle_date(obj.end_date)}"
        )
        return (
            f"{obj.patient.patient_reference} · "
            f"{self.get_supply_period_label(obj)} · {date_range}"
        )

    def get_due_status(self, obj: DosetteCycle) -> str:
        today = timezone.localdate()
        if obj.status in CLOSED_CYCLE_STATUSES:
            return "closed"
        if obj.end_date < today:
            return "overdue"
        if obj.start_date <= today <= obj.end_date:
            return "current"

        days_until_start = (obj.start_date - today).days
        if (
            obj.status in {CycleStatus.DRAFT, CycleStatus.NEEDS_CHANGES}
            and days_until_start <= PREPARE_SOON_DAYS
        ):
            return "due_soon"
        return "upcoming"

    def get_days_until_due(self, obj: DosetteCycle) -> int:
        today = timezone.localdate()
        if obj.end_date < today:
            return (obj.end_date - today).days
        return (obj.start_date - today).days

    def get_is_due_soon(self, obj: DosetteCycle) -> bool:
        return self.get_due_status(obj) == "due_soon"

    def get_prepared_by_email(self, obj: DosetteCycle) -> str | None:
        return obj.prepared_by.email if obj.prepared_by_id else None

    def get_checked_by_email(self, obj: DosetteCycle) -> str | None:
        return obj.checked_by.email if obj.checked_by_id else None

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


class DosettePeriodSubmitSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)


class DosettePeriodCollectSerializer(serializers.Serializer):
    collected_on = serializers.DateField(required=False)


class DosettePeriodCycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DosetteCycle
        fields = [
            "id",
            "reference",
            "week_number",
            "start_date",
            "end_date",
            "status",
            "stock_deducted",
        ]
        read_only_fields = fields


class DosettePeriodSerializer(serializers.ModelSerializer):
    patient_reference = serializers.CharField(
        source="patient.patient_reference",
        read_only=True,
    )
    cycles = serializers.SerializerMethodField()
    next_due_date = serializers.DateField(read_only=True)
    reminder_date = serializers.DateField(read_only=True)

    class Meta:
        model = DosettePeriod
        fields = [
            "id",
            "patient_reference",
            "start_date",
            "end_date",
            "status",
            "submitted_at",
            "collected_on",
            "next_due_date",
            "reminder_date",
            "cycles",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_cycles(self, obj: DosettePeriod):
        cycles = obj.cycles.order_by("week_number", "id")
        return DosettePeriodCycleSerializer(cycles, many=True).data


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
    colour = serializers.CharField(read_only=True)
    shape = serializers.CharField(read_only=True)


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


class DosetteDeductionMovementSerializer(serializers.Serializer):
    movement_id = serializers.IntegerField(read_only=True)
    batch_id = serializers.IntegerField(read_only=True)
    batch_number = serializers.CharField(read_only=True)
    expiry_date = serializers.DateField(read_only=True)
    quantity_deducted = serializers.IntegerField(read_only=True)
    balance_after = serializers.IntegerField(read_only=True)


class DosetteDeductionLineSerializer(serializers.Serializer):
    medication_id = serializers.IntegerField(read_only=True)
    medication_name = serializers.CharField(read_only=True)
    required_quantity = serializers.IntegerField(read_only=True)
    movements = DosetteDeductionMovementSerializer(many=True, read_only=True)


class DosetteDeductionCycleSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    reference = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    stock_deducted = serializers.BooleanField(read_only=True)
    deducted_at = serializers.DateTimeField(allow_null=True, read_only=True)


class _DosetteDeductionTotalsSerializer(serializers.Serializer):
    required = serializers.IntegerField(read_only=True)
    deducted = serializers.IntegerField(read_only=True)


class DosetteDeductionSummarySerializer(serializers.Serializer):
    cycle = DosetteDeductionCycleSerializer(read_only=True)
    cycle_days = serializers.IntegerField(read_only=True)
    patient_reference = serializers.CharField(read_only=True)
    deductions = DosetteDeductionLineSerializer(many=True, read_only=True)
    totals = _DosetteDeductionTotalsSerializer(read_only=True)
