from rest_framework.routers import DefaultRouter

from .views import PatientNoteViewSet, PatientViewSet

router = DefaultRouter()
router.register("patients", PatientViewSet, basename="patient")
router.register("patient-notes", PatientNoteViewSet, basename="patient-note")

urlpatterns = router.urls
