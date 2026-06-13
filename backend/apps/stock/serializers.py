from rest_framework import serializers

from .models import (
    Manufacturer,
    Medicine,
    StockBatch,
    StockMovement,
    Supplier,
)


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "account_ref", "lead_time_days", "email", "phone"]


class ManufacturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Manufacturer
        fields = ["id", "name"]


class StockBatchSerializer(serializers.ModelSerializer):
    medicine_label = serializers.CharField(source="medicine.label", read_only=True)
    days_to_expiry = serializers.IntegerField(read_only=True)
    expiry_band = serializers.CharField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = StockBatch
        fields = [
            "id", "medicine", "medicine_label", "supplier", "supplier_name",
            "batch_number", "expiry_date", "quantity_received", "quantity_on_hand",
            "location", "received_date", "unit_cost",
            "days_to_expiry", "expiry_band", "is_expired",
        ]


class MedicineSerializer(serializers.ModelSerializer):
    label = serializers.CharField(read_only=True)
    quantity_on_hand = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()
    stock_value = serializers.SerializerMethodField()
    manufacturer_name = serializers.CharField(source="manufacturer.name", read_only=True)
    supplier_name = serializers.CharField(source="default_supplier.name", read_only=True)

    class Meta:
        model = Medicine
        fields = [
            "id", "name", "strength", "form", "label", "pack_size", "unit",
            "manufacturer", "manufacturer_name", "default_supplier", "supplier_name",
            "reorder_level", "reorder_quantity", "unit_cost", "is_active",
            "quantity_on_hand", "is_low_stock", "stock_value",
        ]

    def get_quantity_on_hand(self, obj):
        return obj.quantity_on_hand()

    def get_is_low_stock(self, obj):
        return obj.is_low_stock()

    def get_stock_value(self, obj):
        return round(float(obj.stock_value()), 2)


class MedicineDetailSerializer(MedicineSerializer):
    batches = serializers.SerializerMethodField()

    class Meta(MedicineSerializer.Meta):
        fields = MedicineSerializer.Meta.fields + ["batches"]

    def get_batches(self, obj):
        qs = obj.batches.filter(quantity_on_hand__gt=0).order_by("expiry_date")
        return StockBatchSerializer(qs, many=True).data


class StockMovementSerializer(serializers.ModelSerializer):
    medicine_label = serializers.CharField(source="batch.medicine.label", read_only=True)
    batch_number = serializers.CharField(source="batch.batch_number", read_only=True)
    actor_name = serializers.CharField(source="actor.get_full_name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id", "batch", "batch_number", "medicine_label", "kind",
            "quantity", "reason", "actor", "actor_name", "reference", "created_at",
        ]
        read_only_fields = ["actor"]


class AdjustmentSerializer(serializers.Serializer):
    """Input for stock adjustments and wastage against a specific batch."""

    batch = serializers.PrimaryKeyRelatedField(queryset=StockBatch.objects.all())
    quantity = serializers.IntegerField(help_text="Signed change; negative reduces stock.")
    kind = serializers.ChoiceField(choices=["adjust", "waste", "return"])
    reason = serializers.CharField(max_length=200)
