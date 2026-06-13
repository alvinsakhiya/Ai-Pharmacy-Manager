from rest_framework import serializers

from .models import DosetteCycle, DosetteItem, DosettePlan


class DosetteItemSerializer(serializers.ModelSerializer):
    medicine_label = serializers.CharField(source="medicine.label", read_only=True)
    doses_per_week = serializers.SerializerMethodField()

    class Meta:
        model = DosetteItem
        fields = [
            "id", "plan", "medicine", "medicine_label", "dose_quantity",
            "schedule", "instructions", "doses_per_week",
        ]

    def get_doses_per_week(self, obj):
        return obj.doses_per_week()


class DosettePlanSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_ref = serializers.CharField(source="patient.patient_id", read_only=True)
    review_overdue = serializers.BooleanField(read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = DosettePlan
        fields = [
            "id", "patient", "patient_name", "patient_ref", "frequency",
            "start_date", "review_date", "review_overdue", "is_active",
            "notes", "item_count", "created_at",
        ]

    def get_item_count(self, obj):
        return obj.items.count()


class DosettePlanDetailSerializer(DosettePlanSerializer):
    items = DosetteItemSerializer(many=True, read_only=True)
    doses_per_cycle = serializers.SerializerMethodField()

    class Meta(DosettePlanSerializer.Meta):
        fields = DosettePlanSerializer.Meta.fields + ["items", "doses_per_cycle"]

    def get_doses_per_cycle(self, obj):
        return obj.doses_per_cycle()


class DosetteCycleSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="plan.patient.full_name", read_only=True)
    patient_ref = serializers.CharField(source="plan.patient.patient_id", read_only=True)
    days_to_due = serializers.IntegerField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = DosetteCycle
        fields = [
            "id", "plan", "patient_name", "patient_ref", "cycle_start", "cycle_end",
            "due_date", "days_to_due", "is_overdue", "status",
            "assembled_by", "checked_by", "sealed_at",
        ]
        read_only_fields = [
            "status", "assembled_by", "checked_by", "sealed_at",
        ]
