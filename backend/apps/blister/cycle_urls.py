from django.urls import path

from .views import (
    DosetteCycleCancelView,
    DosetteCycleDetailView,
    DosetteCycleListCreateView,
    DosetteCyclePrepareView,
)

urlpatterns = [
    path("", DosetteCycleListCreateView.as_view(), name="dosette-cycle-list"),
    path("<int:pk>/", DosetteCycleDetailView.as_view(), name="dosette-cycle-detail"),
    path(
        "<int:pk>/prepare/",
        DosetteCyclePrepareView.as_view(),
        name="dosette-cycle-prepare",
    ),
    path(
        "<int:pk>/cancel/",
        DosetteCycleCancelView.as_view(),
        name="dosette-cycle-cancel",
    ),
]
