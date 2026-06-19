from rest_framework import serializers

from .models import StockBatch, StockItem


class StockBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockBatch
        fields = [
            "id",
            "batch_number",
            "expiry_date",
            "quantity",
            "quantity_received",
            "received_at",
            "is_active",
        ]
        read_only_fields = fields


class StockItemSerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source="medication.name", read_only=True)
    quantity_on_hand = serializers.IntegerField(read_only=True)
    earliest_expiry = serializers.DateField(allow_null=True, read_only=True)

    class Meta:
        model = StockItem
        fields = [
            "id",
            "pharmacy",
            "medication",
            "medication_name",
            "unit_price",
            "reorder_level",
            "is_active",
            "quantity_on_hand",
            "earliest_expiry",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class StockItemDetailSerializer(StockItemSerializer):
    batches = StockBatchSerializer(many=True, read_only=True)

    class Meta(StockItemSerializer.Meta):
        fields = [*StockItemSerializer.Meta.fields, "batches"]
        read_only_fields = fields
