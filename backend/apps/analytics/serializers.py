from rest_framework import serializers


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
