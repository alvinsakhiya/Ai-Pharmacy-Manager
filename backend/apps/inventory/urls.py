from django.urls import path

from .views import (
    StockAdjustView,
    StockCountView,
    StockItemDetailView,
    StockItemListView,
    StockReceiveView,
)

urlpatterns = [
    path("batches/<int:pk>/adjust/", StockAdjustView.as_view(), name="stock-adjust"),
    path("batches/<int:pk>/count/", StockCountView.as_view(), name="stock-count"),
    path("receipts/", StockReceiveView.as_view(), name="stock-receive"),
    path("stock-items/", StockItemListView.as_view(), name="stock-item-list"),
    path(
        "stock-items/<int:pk>/",
        StockItemDetailView.as_view(),
        name="stock-item-detail",
    ),
]
