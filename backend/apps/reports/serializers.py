from rest_framework import serializers

from apps.analytics.serializers import (
    StockAnalyticsItemSerializer,
    StockAnalyticsSummarySerializer,
    StockAnalyticsThresholdsSerializer,
)


class StockAttentionReportFiltersSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(allow_null=True, read_only=True)
    flag = serializers.CharField(allow_null=True, read_only=True)
    needs_attention = serializers.BooleanField(read_only=True)


class StockAttentionReportSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    thresholds = StockAnalyticsThresholdsSerializer(read_only=True)
    filters = StockAttentionReportFiltersSerializer(read_only=True)
    summary = StockAnalyticsSummarySerializer(read_only=True)
    row_count = serializers.IntegerField(read_only=True)
    rows = StockAnalyticsItemSerializer(many=True, read_only=True)


class StockMovementsReportRowSerializer(serializers.Serializer):
    movement_id = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    stock_item_id = serializers.IntegerField(read_only=True)
    medication_id = serializers.IntegerField(read_only=True)
    medication_name = serializers.CharField(read_only=True)
    pharmacy_id = serializers.IntegerField(read_only=True)
    batch_id = serializers.IntegerField(allow_null=True, read_only=True)
    batch_number = serializers.CharField(allow_null=True, read_only=True)
    movement_type = serializers.CharField(read_only=True)
    quantity_delta = serializers.IntegerField(read_only=True)
    balance_after = serializers.IntegerField(read_only=True)
    reference = serializers.CharField(read_only=True)


class StockMovementsReportFiltersSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(allow_null=True, read_only=True)
    medication_id = serializers.IntegerField(allow_null=True, read_only=True)
    stock_item_id = serializers.IntegerField(allow_null=True, read_only=True)
    movement_type = serializers.CharField(allow_null=True, read_only=True)
    date_from = serializers.DateField(allow_null=True, read_only=True)
    date_to = serializers.DateField(allow_null=True, read_only=True)
    limit = serializers.IntegerField(read_only=True)


class StockMovementsReportSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    filters = StockMovementsReportFiltersSerializer(read_only=True)
    row_count = serializers.IntegerField(read_only=True)
    limited = serializers.BooleanField(read_only=True)
    rows = StockMovementsReportRowSerializer(many=True, read_only=True)
