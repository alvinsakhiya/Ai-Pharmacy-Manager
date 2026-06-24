from django.urls import path

from .views import (
    PatientMedicationAppearanceView,
    PatientMedicationDetailView,
    PatientMedicationDiscontinueView,
    PatientMedicationListCreateView,
)

urlpatterns = [
    path("", PatientMedicationListCreateView.as_view(), name="patient-medication-list"),
    path(
        "<int:pk>/",
        PatientMedicationDetailView.as_view(),
        name="patient-medication-detail",
    ),
    path(
        "<int:pk>/appearance/",
        PatientMedicationAppearanceView.as_view(),
        name="patient-medication-appearance",
    ),
    path(
        "<int:pk>/discontinue/",
        PatientMedicationDiscontinueView.as_view(),
        name="patient-medication-discontinue",
    ),
]
