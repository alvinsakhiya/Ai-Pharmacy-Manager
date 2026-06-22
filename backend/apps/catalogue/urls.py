from django.urls import path

from .views import (
    CatalogueProductDetailView,
    CatalogueProductListView,
    MedicationDetailView,
    MedicationListCreateView,
)

urlpatterns = [
    path(
        "products/",
        CatalogueProductListView.as_view(),
        name="catalogue-product-list",
    ),
    path(
        "products/<int:pk>/",
        CatalogueProductDetailView.as_view(),
        name="catalogue-product-detail",
    ),
    path(
        "medications/",
        MedicationListCreateView.as_view(),
        name="medication-list-create",
    ),
    path(
        "medications/<int:pk>/",
        MedicationDetailView.as_view(),
        name="medication-detail",
    ),
]
