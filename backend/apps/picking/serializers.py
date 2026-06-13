from datetime import date

from rest_framework import serializers

from .models import PickingItem, PickingList


class PickingListGenerateSerializer(serializers.Serializer):
    period_start = serializers.DateField(required=False, default=date.today)
    weeks = serializers.IntegerField(required=False, default=1, min_value=1, max_value=52)


class PickingItemSerializer(serializers.ModelSerializer):
    medicine_label = serializers.CharField(source="medicine.label", read_only=True)
    is_short = serializers.BooleanField(read_only=True)
    picked_by_name = serializers.CharField(source="picked_by.get_full_name", read_only=True)

    class Meta:
        model = PickingItem
        fields = [
            "id", "picking_list", "medicine", "medicine_label", "quantity_required",
            "quantity_available", "patient_count", "is_short",
            "is_picked", "picked_by", "picked_by_name", "picked_at",
        ]


class PickingListSerializer(serializers.ModelSerializer):
    progress = serializers.FloatField(read_only=True)
    item_count = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = PickingList
        fields = [
            "id", "name", "period_start", "period_end", "status", "progress",
            "item_count", "created_by", "created_by_name", "created_at",
        ]

    def get_item_count(self, obj):
        return obj.items.count()


class PickingListDetailSerializer(PickingListSerializer):
    items = PickingItemSerializer(many=True, read_only=True)

    class Meta(PickingListSerializer.Meta):
        fields = PickingListSerializer.Meta.fields + ["items"]
