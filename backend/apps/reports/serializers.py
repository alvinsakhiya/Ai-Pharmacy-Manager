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
