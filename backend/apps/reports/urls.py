from django.urls import path

from .views import StockAttentionReportCsvView, StockAttentionReportView

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
]
