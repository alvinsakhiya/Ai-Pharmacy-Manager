from django.urls import path

from .views import (
    DashboardView,
    ReportIndexView,
    ReportView,
    StockTrendView,
)

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("dashboard/stock-trend/", StockTrendView.as_view(), name="stock-trend"),
    path("reports/", ReportIndexView.as_view(), name="report-index"),
    path("reports/<str:key>/", ReportView.as_view(), name="report"),
]
