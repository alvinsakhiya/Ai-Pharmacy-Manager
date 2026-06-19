from django.urls import path

from .views import PatientDeactivateView, PatientDetailView, PatientListCreateView

urlpatterns = [
    path("", PatientListCreateView.as_view(), name="patient-list"),
    path("<int:pk>/", PatientDetailView.as_view(), name="patient-detail"),
    path(
        "<int:pk>/deactivate/",
        PatientDeactivateView.as_view(),
        name="patient-deactivate",
    ),
]
