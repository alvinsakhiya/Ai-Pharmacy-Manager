from django.urls import path

from .views import StockOverviewView

urlpatterns = [
    path(
        "stock/overview/", StockOverviewView.as_view(), name="analytics-stock-overview"
    ),
]
