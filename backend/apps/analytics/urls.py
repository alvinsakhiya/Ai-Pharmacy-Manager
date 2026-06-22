from django.urls import path

from .views import (
    ForecastDetailView,
    ForecastGenerateView,
    ForecastLatestView,
    StockOverviewView,
)

urlpatterns = [
    path("forecasts/", ForecastGenerateView.as_view(), name="analytics-forecast-run"),
    path(
        "forecasts/latest/",
        ForecastLatestView.as_view(),
        name="analytics-forecast-latest",
    ),
    path(
        "forecasts/<int:pk>/",
        ForecastDetailView.as_view(),
        name="analytics-forecast-detail",
    ),
    path(
        "stock/overview/", StockOverviewView.as_view(), name="analytics-stock-overview"
    ),
]
