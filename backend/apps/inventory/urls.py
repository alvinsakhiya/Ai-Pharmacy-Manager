from django.urls import path

from .views import StockItemDetailView, StockItemListView

urlpatterns = [
    path("stock-items/", StockItemListView.as_view(), name="stock-item-list"),
    path(
        "stock-items/<int:pk>/",
        StockItemDetailView.as_view(),
        name="stock-item-detail",
    ),
]
