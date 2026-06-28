from django.urls import path

from .views import DosettePeriodCollectedView, DosettePeriodListCreateView

urlpatterns = [
    path("", DosettePeriodListCreateView.as_view(), name="dosette-period-list"),
    path(
        "<int:period_pk>/collected/",
        DosettePeriodCollectedView.as_view(),
        name="dosette-period-collected",
    ),
]
