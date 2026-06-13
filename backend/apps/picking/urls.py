from rest_framework.routers import DefaultRouter

from .views import PickingItemViewSet, PickingListViewSet

router = DefaultRouter()
router.register("picking-lists", PickingListViewSet, basename="picking-list")
router.register("picking-items", PickingItemViewSet, basename="picking-item")

urlpatterns = router.urls
