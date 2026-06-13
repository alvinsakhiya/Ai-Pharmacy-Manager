from rest_framework import serializers

from .models import DAYS, SLOTS, DosetteCycle, DosetteItem, DosettePlan


class DosetteItemSerializer(serializers.ModelSerializer):
    medicine_label = serializers.CharField(source="medicine.label", read_only=True)
    doses_per_week = serializers.SerializerMethodField()
    dose_quantity = serializers.IntegerField(min_value=1)

    class Meta:
        model = DosetteItem
        fields = [
            "id", "plan", "medicine", "medicine_label", "dose_quantity",
            "schedule", "instructions", "doses_per_week",
        ]

    def validate_schedule(self, schedule):
        if not isinstance(schedule, dict) or not schedule:
            raise serializers.ValidationError(
                "Provide at least one scheduled day and dosage slot."
            )

        unknown_days = sorted(set(schedule) - set(DAYS))
        if unknown_days:
            raise serializers.ValidationError(
                f"Unknown day keys: {', '.join(unknown_days)}."
            )

        occurrences = 0
        for day, slots in schedule.items():
            if not isinstance(slots, list):
                raise serializers.ValidationError(
                    f"Slots for '{day}' must be a list."
                )
            if len(slots) != len(set(slots)):
                raise serializers.ValidationError(
                    f"Slots for '{day}' must not contain duplicates."
                )
            unknown_slots = sorted(set(slots) - set(SLOTS))
            if unknown_slots:
                raise serializers.ValidationError(
                    f"Unknown slots for '{day}': {', '.join(unknown_slots)}."
                )
            occurrences += len(slots)

        if occurrences == 0:
            raise serializers.ValidationError(
                "Provide at least one dosage occurrence."
            )
        return schedule

    def validate(self, attrs):
        plan = attrs.get("plan", getattr(self.instance, "plan", None))
        medicine = attrs.get("medicine", getattr(self.instance, "medicine", None))
        if plan and medicine:
            duplicate = DosetteItem.objects.filter(
                plan=plan,
                medicine=medicine,
            )
            if self.instance:
                duplicate = duplicate.exclude(pk=self.instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError({
                    "medicine": "This medicine is already present in the plan."
                })
        return attrs

    def get_doses_per_week(self, obj) -> int:
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

    def get_item_count(self, obj) -> int:
        return obj.items.count()


class DosettePlanDetailSerializer(DosettePlanSerializer):
    items = DosetteItemSerializer(many=True, read_only=True)
    doses_per_cycle = serializers.SerializerMethodField()

    class Meta(DosettePlanSerializer.Meta):
        fields = DosettePlanSerializer.Meta.fields + ["items", "doses_per_cycle"]

    def get_doses_per_cycle(self, obj) -> dict[int, int]:
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
