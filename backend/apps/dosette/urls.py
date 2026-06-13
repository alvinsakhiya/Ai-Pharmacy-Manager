from rest_framework.routers import DefaultRouter

from .views import DosetteCycleViewSet, DosetteItemViewSet, DosettePlanViewSet

router = DefaultRouter()
router.register("dosette-plans", DosettePlanViewSet, basename="dosette-plan")
router.register("dosette-items", DosetteItemViewSet, basename="dosette-item")
router.register("dosette-cycles", DosetteCycleViewSet, basename="dosette-cycle")

urlpatterns = router.urls
