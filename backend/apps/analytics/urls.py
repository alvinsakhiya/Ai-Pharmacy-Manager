from django.urls import path

from .views import (
    ForecastDetailView,
    ForecastGenerateView,
    ForecastLatestView,
    StockOverviewView,
    TransferSuggestionDismissView,
    TransferSuggestionListCreateView,
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
        "transfer-suggestions/",
        TransferSuggestionListCreateView.as_view(),
        name="analytics-transfer-suggestion-list",
    ),
    path(
        "transfer-suggestions/<int:pk>/dismiss/",
        TransferSuggestionDismissView.as_view(),
        name="analytics-transfer-suggestion-dismiss",
    ),
    path(
        "stock/overview/", StockOverviewView.as_view(), name="analytics-stock-overview"
    ),
]
