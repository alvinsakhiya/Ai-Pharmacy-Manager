from django.urls import path

from .views import (
    StockAttentionReportCsvView,
    StockAttentionReportView,
    StockMovementsReportCsvView,
    StockMovementsReportView,
)

urlpatterns = [
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
]
