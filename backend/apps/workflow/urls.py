from rest_framework.routers import DefaultRouter

from .views import WorkflowJobViewSet

router = DefaultRouter()
router.register("workflow-jobs", WorkflowJobViewSet, basename="workflow-job")

urlpatterns = router.urls
