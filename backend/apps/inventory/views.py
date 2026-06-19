from django.db.models import Prefetch
from rest_framework.generics import ListAPIView, RetrieveAPIView

from apps.tenancy.permissions import Action, require

from .models import StockBatch
from .selectors import stock_items_for
from .serializers import StockItemDetailSerializer, StockItemSerializer


class StockItemListView(ListAPIView):
    serializer_class = StockItemSerializer
    permission_classes = [require(Action.STOCK_VIEW)]

    def get_queryset(self):
        queryset = stock_items_for(self.request.user)
        pharmacy_id = self.request.query_params.get("pharmacy")
        if pharmacy_id is not None:
            try:
                pharmacy_id_int = int(pharmacy_id)
            except ValueError:
                return queryset.none()
            queryset = queryset.filter(pharmacy_id=pharmacy_id_int)
        return queryset


class StockItemDetailView(RetrieveAPIView):
    serializer_class = StockItemDetailSerializer
    permission_classes = [require(Action.STOCK_VIEW)]

    def get_queryset(self):
        return stock_items_for(self.request.user).prefetch_related(
            Prefetch("batches", queryset=StockBatch.objects.all()),
        )
