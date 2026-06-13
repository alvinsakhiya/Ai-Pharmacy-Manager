from rest_framework import serializers
from .models import (
    DraftPurchaseOrder,
    DraftPurchaseOrderItem,
    Medication,
    StockBatch,
    StockMovement,
    Supplier,
)


class SupplierSerializer(serializers.ModelSerializer):
    preferred_medication_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Supplier
        fields = (
            "id",
            "name",
            "contact_name",
            "email",
            "phone",
            "account_reference",
            "lead_time_days",
            "notes",
            "is_active",
            "preferred_medication_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "preferred_medication_count",
            "created_at",
            "updated_at",
        )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Supplier name is required.")
        duplicates = Supplier.objects.filter(name__iexact=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(
                "A supplier with this name already exists."
            )
        return value

    def validate(self, attrs):
        for field_name in (
            "contact_name",
            "phone",
            "account_reference",
            "notes",
        ):
            if field_name in attrs:
                attrs[field_name] = attrs[field_name].strip()
        return attrs


class MedicationSerializer(serializers.ModelSerializer):
    preferred_supplier_name = serializers.CharField(
        source="preferred_supplier.name",
        read_only=True,
    )

    class Meta:
        model = Medication
        fields = "__all__"

    def validate(self, attrs):
        minimum_stock_level = attrs.get(
            "minimum_stock_level",
            getattr(self.instance, "minimum_stock_level", 0),
        )
        reorder_threshold = attrs.get(
            "reorder_threshold",
            getattr(self.instance, "reorder_threshold", 0),
        )

        if reorder_threshold < minimum_stock_level:
            raise serializers.ValidationError(
                {
                    "reorder_threshold": (
                        "Reorder threshold cannot be below the minimum stock level."
                    )
                }
            )

        return attrs


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


class DraftPurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DraftPurchaseOrderItem
        fields = (
            "id",
            "medication",
            "medication_name",
            "quantity",
            "recommended_quantity",
            "current_stock",
            "target_stock",
            "rationale",
        )
        read_only_fields = fields


class DraftPurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(
        source="supplier.name",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    created_by_display = serializers.SerializerMethodField()
    reference = serializers.CharField(read_only=True)
    total_units = serializers.IntegerField(read_only=True)
    items = DraftPurchaseOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = DraftPurchaseOrder
        fields = (
            "id",
            "reference",
            "supplier",
            "supplier_name",
            "status",
            "status_label",
            "notes",
            "created_by_display",
            "total_units",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "reference",
            "supplier",
            "supplier_name",
            "status_label",
            "created_by_display",
            "total_units",
            "items",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        if (
            self.instance
            and self.instance.status == DraftPurchaseOrder.Status.ARCHIVED
        ):
            raise serializers.ValidationError(
                "Archived draft purchase orders are read-only."
            )
        if "notes" in attrs:
            attrs["notes"] = attrs["notes"].strip()
        return attrs

    def get_created_by_display(self, obj):
        return obj.created_by_username or "System"


class DraftPurchaseOrderCreateSerializer(serializers.Serializer):
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.filter(is_active=True),
    )
    medication_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        max_length=200,
    )
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2000,
        trim_whitespace=True,
    )

    def validate_medication_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError(
                "Select each medication only once."
            )
        return value
