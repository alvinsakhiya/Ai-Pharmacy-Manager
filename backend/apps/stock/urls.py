from rest_framework.routers import DefaultRouter

from .views import (
    ManufacturerViewSet,
    MedicineViewSet,
    StockBatchViewSet,
    StockMovementViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("manufacturers", ManufacturerViewSet, basename="manufacturer")
router.register("medicines", MedicineViewSet, basename="medicine")
router.register("batches", StockBatchViewSet, basename="batch")
router.register("movements", StockMovementViewSet, basename="movement")

urlpatterns = router.urls
