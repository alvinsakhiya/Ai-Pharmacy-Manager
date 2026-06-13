from rest_framework import serializers
from .models import Medication, StockBatch, StockMovement


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

    def validate_quantity(self, value):
        if self.instance is not None and value != self.instance.quantity:
            raise serializers.ValidationError(
                "Use the controlled stock adjustment endpoint to change quantity."
            )
        return value


class StockAdjustmentSerializer(serializers.Serializer):
    movement_type = serializers.ChoiceField(
        choices=StockMovement.MovementType.choices
    )
    quantity_change = serializers.IntegerField()
    reason = serializers.CharField(
        max_length=300,
        trim_whitespace=True,
        allow_blank=False,
    )

    def validate_quantity_change(self, value):
        if value == 0:
            raise serializers.ValidationError(
                "Quantity change must not be zero."
            )
        return value


class StockMovementSerializer(serializers.ModelSerializer):
    movement_type_label = serializers.CharField(
        source="get_movement_type_display",
        read_only=True,
    )
    actor_display = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "stock_batch_identifier",
            "medication_identifier",
            "medication_name",
            "batch_number",
            "movement_type",
            "movement_type_label",
            "quantity_change",
            "quantity_before",
            "quantity_after",
            "reason",
            "actor_display",
            "timestamp",
        )
        read_only_fields = fields

    def get_actor_display(self, obj):
        return obj.actor_username or "System"
