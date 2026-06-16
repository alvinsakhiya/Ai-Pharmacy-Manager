from django.urls import path

from .views import (
    GroupDetailView,
    GroupListCreateView,
    PharmacyDetailView,
    PharmacyListCreateView,
)

urlpatterns = [
    path("groups/", GroupListCreateView.as_view(), name="group-list-create"),
    path("groups/<int:pk>/", GroupDetailView.as_view(), name="group-detail"),
    path(
        "pharmacies/",
        PharmacyListCreateView.as_view(),
        name="pharmacy-list-create",
    ),
    path(
        "pharmacies/<int:pk>/",
        PharmacyDetailView.as_view(),
        name="pharmacy-detail",
    ),
]
