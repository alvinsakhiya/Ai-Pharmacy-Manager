from django.urls import path

from .views import (
    ExpiryRiskView,
    ForecastDetailView,
    ForecastGenerateView,
    ForecastLatestView,
    MdsDemandSignalView,
    StockOverviewView,
    StockReviewQueueView,
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
    path("mds-demand/", MdsDemandSignalView.as_view(), name="analytics-mds-demand"),
    path("expiry-risk/", ExpiryRiskView.as_view(), name="analytics-expiry-risk"),
    path(
        "stock-review-queue/",
        StockReviewQueueView.as_view(),
        name="analytics-stock-review-queue",
    ),
]
