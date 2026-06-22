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


class PharmacyWindowFiltersSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(allow_null=True, read_only=True)
    window_days = serializers.IntegerField(read_only=True)


class ExpiryReportRowSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(read_only=True)
    pharmacy_name = serializers.CharField(read_only=True)
    medication_label = serializers.CharField(read_only=True)
    batch_number = serializers.CharField(read_only=True)
    expiry_date = serializers.DateField(read_only=True)
    quantity = serializers.IntegerField(read_only=True)
    days_until_expiry = serializers.IntegerField(read_only=True)
    severity = serializers.CharField(read_only=True)


class ExpiryReportSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    filters = PharmacyWindowFiltersSerializer(read_only=True)
    row_count = serializers.IntegerField(read_only=True)
    rows = ExpiryReportRowSerializer(many=True, read_only=True)


class DeadStockReportRowSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(read_only=True)
    medication_label = serializers.CharField(read_only=True)
    quantity_on_hand = serializers.IntegerField(read_only=True)
    days_since_last_outbound = serializers.IntegerField(allow_null=True, read_only=True)
    status = serializers.CharField(read_only=True)
    suggested_action = serializers.CharField(read_only=True)


class DeadStockReportSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    filters = PharmacyWindowFiltersSerializer(read_only=True)
    row_count = serializers.IntegerField(read_only=True)
    rows = DeadStockReportRowSerializer(many=True, read_only=True)


class PharmacyFiltersSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(allow_null=True, read_only=True)


class ForecastReorderReportRowSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(read_only=True)
    pharmacy_name = serializers.CharField(read_only=True)
    medication_label = serializers.CharField(read_only=True)
    predicted_usage_units = serializers.IntegerField(read_only=True)
    current_stock_units = serializers.IntegerField(read_only=True)
    suggested_reorder_units = serializers.IntegerField(read_only=True)
    suggested_reorder_packs = serializers.IntegerField(allow_null=True, read_only=True)
    confidence = serializers.DecimalField(
        max_digits=3,
        decimal_places=2,
        read_only=True,
    )
    explanation_summary = serializers.CharField(read_only=True)
    human_review_required = serializers.BooleanField(read_only=True)
    forecast_run_id = serializers.IntegerField(read_only=True)
    forecast_created_at = serializers.DateTimeField(read_only=True)


class ForecastReorderReportSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    filters = PharmacyFiltersSerializer(read_only=True)
    row_count = serializers.IntegerField(read_only=True)
    rows = ForecastReorderReportRowSerializer(many=True, read_only=True)


class TransferSuggestionReportFiltersSerializer(serializers.Serializer):
    group_id = serializers.IntegerField(allow_null=True, read_only=True)
    status = serializers.CharField(allow_null=True, read_only=True)


class TransferSuggestionsReportRowSerializer(serializers.Serializer):
    group_id = serializers.IntegerField(read_only=True)
    group_name = serializers.CharField(read_only=True)
    source_pharmacy_id = serializers.IntegerField(read_only=True)
    source_pharmacy_name = serializers.CharField(read_only=True)
    destination_pharmacy_id = serializers.IntegerField(read_only=True)
    destination_pharmacy_name = serializers.CharField(read_only=True)
    medication_label = serializers.CharField(read_only=True)
    suggested_quantity_units = serializers.IntegerField(read_only=True)
    suggested_quantity_packs = serializers.IntegerField(allow_null=True, read_only=True)
    confidence = serializers.DecimalField(
        max_digits=3,
        decimal_places=2,
        read_only=True,
    )
    status = serializers.CharField(read_only=True)
    reason = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    human_review_required = serializers.BooleanField(read_only=True)


class TransferSuggestionsReportSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    filters = TransferSuggestionReportFiltersSerializer(read_only=True)
    row_count = serializers.IntegerField(read_only=True)
    rows = TransferSuggestionsReportRowSerializer(many=True, read_only=True)


class MdsWorkloadReportRowSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(read_only=True)
    pharmacy_name = serializers.CharField(read_only=True)
    cycle_status = serializers.CharField(read_only=True)
    due_count = serializers.IntegerField(read_only=True)
    overdue_count = serializers.IntegerField(read_only=True)
    upcoming_cycles = serializers.IntegerField(read_only=True)


class MdsWorkloadReportSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    filters = PharmacyWindowFiltersSerializer(read_only=True)
    row_count = serializers.IntegerField(read_only=True)
    rows = MdsWorkloadReportRowSerializer(many=True, read_only=True)


class ReportDashboardFiltersSerializer(serializers.Serializer):
    pharmacy_id = serializers.IntegerField(allow_null=True, read_only=True)
    group_id = serializers.IntegerField(allow_null=True, read_only=True)


class ReportDashboardCardSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    row_count = serializers.IntegerField(read_only=True)
    available_exports = serializers.ListField(
        child=serializers.CharField(),
        read_only=True,
    )
    human_review_required = serializers.BooleanField(read_only=True)


class ReportDashboardSerializer(serializers.Serializer):
    report = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    filters = ReportDashboardFiltersSerializer(read_only=True)
    cards = ReportDashboardCardSerializer(many=True, read_only=True)
