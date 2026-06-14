from django.urls import path

from .views import (
    ForecastSummaryView,
    MedicineBacktestView,
    MedicineForecastView,
    ShortageForecastView,
)

urlpatterns = [
    path("forecast/medicine/<int:medicine_id>/backtest/", MedicineBacktestView.as_view(),
         name="forecast-backtest"),
    path("forecast/medicine/<int:medicine_id>/", MedicineForecastView.as_view(),
         name="forecast-medicine"),
    path("forecast/shortages/", ShortageForecastView.as_view(), name="forecast-shortages"),
    path("forecast/summary/", ForecastSummaryView.as_view(), name="forecast-summary"),
]
