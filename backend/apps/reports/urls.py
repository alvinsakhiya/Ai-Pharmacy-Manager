from django.urls import path

from .views import (
    DeadStockReportCsvView,
    DeadStockReportView,
    ExpiryReportCsvView,
    ExpiryReportView,
    ForecastReorderReportCsvView,
    ForecastReorderReportView,
    MdsWorkloadReportCsvView,
    MdsWorkloadReportView,
    ReportsDashboardView,
    StockAttentionReportCsvView,
    StockAttentionReportView,
    StockMovementsReportCsvView,
    StockMovementsReportView,
    StockValuationReportCsvView,
    StockValuationReportView,
    TransferSuggestionsReportCsvView,
    TransferSuggestionsReportView,
)

urlpatterns = [
    path("dashboard/", ReportsDashboardView.as_view(), name="reports-dashboard"),
    path(
        "stock/attention/",
        StockAttentionReportView.as_view(),
        name="reports-stock-attention",
    ),
    path(
        "stock/attention.csv",
        StockAttentionReportCsvView.as_view(),
        name="reports-stock-attention-csv",
    ),
    path(
        "stock/movements/",
        StockMovementsReportView.as_view(),
        name="reports-stock-movements",
    ),
    path(
        "stock/movements.csv",
        StockMovementsReportCsvView.as_view(),
        name="reports-stock-movements-csv",
    ),
    path("expiry/", ExpiryReportView.as_view(), name="reports-expiry"),
    path("expiry.csv", ExpiryReportCsvView.as_view(), name="reports-expiry-csv"),
    path("dead-stock/", DeadStockReportView.as_view(), name="reports-dead-stock"),
    path(
        "dead-stock.csv",
        DeadStockReportCsvView.as_view(),
        name="reports-dead-stock-csv",
    ),
    path(
        "stock/valuation/",
        StockValuationReportView.as_view(),
        name="reports-stock-valuation",
    ),
    path(
        "stock/valuation.csv",
        StockValuationReportCsvView.as_view(),
        name="reports-stock-valuation-csv",
    ),
    path(
        "forecast-reorder/",
        ForecastReorderReportView.as_view(),
        name="reports-forecast-reorder",
    ),
    path(
        "forecast-reorder.csv",
        ForecastReorderReportCsvView.as_view(),
        name="reports-forecast-reorder-csv",
    ),
    path(
        "transfer-suggestions/",
        TransferSuggestionsReportView.as_view(),
        name="reports-transfer-suggestions",
    ),
    path(
        "transfer-suggestions.csv",
        TransferSuggestionsReportCsvView.as_view(),
        name="reports-transfer-suggestions-csv",
    ),
    path(
        "mds-workload/",
        MdsWorkloadReportView.as_view(),
        name="reports-mds-workload",
    ),
    path(
        "mds-workload.csv",
        MdsWorkloadReportCsvView.as_view(),
        name="reports-mds-workload-csv",
    ),
]
