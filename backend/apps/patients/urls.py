from django.urls import path

from .views import (
    PatientDeactivateView,
    PatientDetailView,
    PatientGpView,
    PatientListCreateView,
    PatientNoteListCreateView,
)

urlpatterns = [
    path("", PatientListCreateView.as_view(), name="patient-list"),
    path("<int:pk>/", PatientDetailView.as_view(), name="patient-detail"),
    path("<int:pk>/gp/", PatientGpView.as_view(), name="patient-gp"),
    path("<int:pk>/notes/", PatientNoteListCreateView.as_view(), name="patient-notes"),
    path(
        "<int:pk>/deactivate/",
        PatientDeactivateView.as_view(),
        name="patient-deactivate",
    ),
]
