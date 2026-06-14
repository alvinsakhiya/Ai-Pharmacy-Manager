from rest_framework.routers import DefaultRouter

from .views import TrustedDirectionViewSet

router = DefaultRouter()
router.register(
    "trusted-directions", TrustedDirectionViewSet, basename="trusted-direction"
)

urlpatterns = router.urls
