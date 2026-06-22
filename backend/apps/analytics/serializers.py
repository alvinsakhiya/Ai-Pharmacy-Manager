from rest_framework import serializers

from .models import ForecastItem, ForecastRun, TransferSuggestion


class ForecastItemSerializer(serializers.ModelSerializer):
    stock_item = serializers.IntegerField(source="stock_item_id", read_only=True)
    catalogue_product = serializers.IntegerField(
        source="catalogue_product_id",
        allow_null=True,
        read_only=True,
    )

    class Meta:
        model = ForecastItem
        fields = [
            "id",
            "stock_item",
            "catalogue_product",
            "medication_label",
            "predicted_usage_units",
            "predicted_usage_packs",
            "current_stock_units",
            "current_stock_packs",
            "safety_stock_units",
            "suggested_reorder_units",
            "suggested_reorder_packs",
            "confidence",
            "explanation",
            "history_points_count",
            "window_days",
            "created_at",
        ]


class ForecastRunSerializer(serializers.ModelSerializer):
    pharmacy = serializers.IntegerField(source="pharmacy_id", read_only=True)
    group = serializers.IntegerField(source="group_id", read_only=True)
    generated_by = serializers.IntegerField(source="generated_by_id", read_only=True)
    items = ForecastItemSerializer(many=True, read_only=True)

    class Meta:
        model = ForecastRun
        fields = [
            "id",
            "pharmacy",
            "group",
            "horizon_days",
            "lookback_days",
            "model_version",
            "is_demo",
            "generated_by",
            "status",
            "created_at",
            "items",
        ]


class ForecastGenerateSerializer(serializers.Serializer):
    pharmacy = serializers.IntegerField()
    horizon_days = serializers.ChoiceField(
        choices=(30, 60, 90),
        default=30,
        required=False,
    )


class TransferSuggestionSerializer(serializers.ModelSerializer):
    group = serializers.IntegerField(source="group_id", read_only=True)
    catalogue_product = serializers.IntegerField(
        source="catalogue_product_id",
        allow_null=True,
        read_only=True,
    )
    source_pharmacy = serializers.IntegerField(
        source="source_pharmacy_id",
        read_only=True,
    )
    source_pharmacy_name = serializers.CharField(
        source="source_pharmacy.name",
        read_only=True,
    )
    destination_pharmacy = serializers.IntegerField(
        source="destination_pharmacy_id",
        read_only=True,
    )
    destination_pharmacy_name = serializers.CharField(
        source="destination_pharmacy.name",
        read_only=True,
    )
    source_stock_item = serializers.IntegerField(
        source="source_stock_item_id",
        allow_null=True,
        read_only=True,
    )
    destination_stock_item = serializers.IntegerField(
        source="destination_stock_item_id",
        allow_null=True,
        read_only=True,
    )
    generated_by = serializers.IntegerField(source="generated_by_id", read_only=True)

    class Meta:
        model = TransferSuggestion
        fields = [
            "id",
            "group",
            "catalogue_product",
            "medication_label",
            "source_pharmacy",
            "source_pharmacy_name",
            "destination_pharmacy",
            "destination_pharmacy_name",
            "source_stock_item",
            "destination_stock_item",
            "suggested_quantity_units",
            "suggested_quantity_packs",
            "current_source_stock_units",
            "destination_recent_usage_units",
            "dead_days",
            "confidence",
            "reason",
            "status",
            "model_version",
            "generated_by",
            "created_at",
            "updated_at",
        ]


class TransferSuggestionGenerateSerializer(serializers.Serializer):
    group = serializers.IntegerField()
    dead_days = serializers.IntegerField(min_value=7, max_value=180, default=30)


class StockAnalyticsFlagsSerializer(serializers.Serializer):
    near_expiry = serializers.BooleanField(read_only=True)
    low_stock = serializers.BooleanField(read_only=True)
    stockout = serializers.BooleanField(read_only=True)
    dead_stock = serializers.BooleanField(read_only=True)
    slow_moving = serializers.BooleanField(read_only=True)


class StockAnalyticsItemSerializer(serializers.Serializer):
    stock_item_id = serializers.IntegerField(read_only=True)
    medication_id = serializers.IntegerField(read_only=True)
    medication_name = serializers.CharField(read_only=True)
    pharmacy_id = serializers.IntegerField(read_only=True)
    quantity_on_hand = serializers.IntegerField(read_only=True)
    reorder_level = serializers.IntegerField(read_only=True)
    earliest_expiry = serializers.DateField(allow_null=True, read_only=True)
    days_to_expiry = serializers.IntegerField(allow_null=True, read_only=True)
    consumption_window = serializers.IntegerField(read_only=True)
    flags = StockAnalyticsFlagsSerializer(read_only=True)
    attention_score = serializers.IntegerField(read_only=True)
    suggested_reorder_quantity = serializers.IntegerField(read_only=True)
    reasons = serializers.ListField(
        child=serializers.CharField(),
        read_only=True,
    )


class StockAnalyticsSummarySerializer(serializers.Serializer):
    total_items = serializers.IntegerField(read_only=True)
    stockout = serializers.IntegerField(read_only=True)
    low_stock = serializers.IntegerField(read_only=True)
    near_expiry = serializers.IntegerField(read_only=True)
    dead_stock = serializers.IntegerField(read_only=True)
    slow_moving = serializers.IntegerField(read_only=True)
    needs_attention = serializers.IntegerField(read_only=True)


class StockAnalyticsThresholdsSerializer(serializers.Serializer):
    near_expiry_days = serializers.IntegerField(read_only=True)
    dead_stock_days = serializers.IntegerField(read_only=True)
    slow_moving_threshold = serializers.IntegerField(read_only=True)


class StockOverviewSerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField(read_only=True)
    thresholds = StockAnalyticsThresholdsSerializer(read_only=True)
    summary = StockAnalyticsSummarySerializer(read_only=True)
    items = StockAnalyticsItemSerializer(many=True, read_only=True)
