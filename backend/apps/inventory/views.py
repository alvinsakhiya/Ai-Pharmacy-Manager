from django.db.models import Prefetch
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.permissions import Action, require

from .models import StockBatch
from .selectors import stock_items_for
from .serializers import (
    ReceiveStockSerializer,
    StockItemDetailSerializer,
    StockItemSerializer,
)
from .services import receive_stock


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


class StockReceiveView(APIView):
    permission_classes = [require(Action.STOCK_MANAGE)]

    def post(self, request):
        serializer = ReceiveStockSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        stock_item, movement = receive_stock(
            actor=request.user,
            request=request,
            **serializer.validated_data,
        )
        reloaded_stock_item = (
            stock_items_for(request.user)
            .prefetch_related(Prefetch("batches", queryset=StockBatch.objects.all()))
            .get(pk=stock_item.pk)
        )
        return Response(
            {
                "stock_item": StockItemDetailSerializer(reloaded_stock_item).data,
                "movement": {
                    "id": movement.id,
                    "movement_type": movement.movement_type,
                    "quantity_delta": movement.quantity_delta,
                    "balance_after": movement.balance_after,
                    "batch": movement.batch_id,
                },
            },
            status=status.HTTP_201_CREATED,
        )
