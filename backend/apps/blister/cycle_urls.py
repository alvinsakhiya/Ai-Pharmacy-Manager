from django.urls import path

from .views import (
    DosetteCycleCancelView,
    DosetteCycleDeductStockView,
    DosetteCycleDetailView,
    DosetteCycleListCreateView,
    DosetteCyclePrepareView,
    PickingListView,
    StockPreviewView,
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
    path(
        "<int:cycle_pk>/picking-list/",
        PickingListView.as_view(),
        name="dosette-cycle-picking-list",
    ),
    path(
        "<int:cycle_pk>/stock-preview/",
        StockPreviewView.as_view(),
        name="dosette-cycle-stock-preview",
    ),
    path(
        "<int:cycle_pk>/deduct-stock/",
        DosetteCycleDeductStockView.as_view(),
        name="dosette-cycle-deduct-stock",
    ),
]
