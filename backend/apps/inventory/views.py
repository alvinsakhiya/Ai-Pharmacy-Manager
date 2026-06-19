from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.permissions import Action, require

from .models import StockBatch
from .selectors import stock_items_for
from .serializers import (
    AdjustStockSerializer,
    CountStockSerializer,
    ReceiveStockSerializer,
    StockItemDetailSerializer,
    StockItemSerializer,
)
from .services import adjust_stock, receive_stock, reconcile_count


def _reload_stock_item_for_response(stock_item, user):
    return (
        stock_items_for(user)
        .prefetch_related(Prefetch("batches", queryset=StockBatch.objects.all()))
        .get(pk=stock_item.pk)
    )


def _movement_summary(movement):
    if movement is None:
        return None
    return {
        "id": movement.id,
        "movement_type": movement.movement_type,
        "quantity_delta": movement.quantity_delta,
        "balance_after": movement.balance_after,
        "batch": movement.batch_id,
    }


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
        reloaded_stock_item = _reload_stock_item_for_response(stock_item, request.user)
        return Response(
            {
                "stock_item": StockItemDetailSerializer(reloaded_stock_item).data,
                "movement": _movement_summary(movement),
            },
            status=status.HTTP_201_CREATED,
        )


class StockAdjustView(APIView):
    permission_classes = [require(Action.STOCK_MANAGE)]

    def post(self, request, pk):
        batch = get_object_or_404(StockBatch.scoped.for_user(request.user), pk=pk)
        serializer = AdjustStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stock_item, movement = adjust_stock(
            actor=request.user,
            batch=batch,
            request=request,
            **serializer.validated_data,
        )
        reloaded_stock_item = _reload_stock_item_for_response(stock_item, request.user)
        return Response(
            {
                "stock_item": StockItemDetailSerializer(reloaded_stock_item).data,
                "movement": _movement_summary(movement),
            },
            status=status.HTTP_200_OK,
        )


class StockCountView(APIView):
    permission_classes = [require(Action.STOCK_MANAGE)]

    def post(self, request, pk):
        batch = get_object_or_404(StockBatch.scoped.for_user(request.user), pk=pk)
        serializer = CountStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stock_item, movement = reconcile_count(
            actor=request.user,
            batch=batch,
            request=request,
            **serializer.validated_data,
        )
        reloaded_stock_item = _reload_stock_item_for_response(stock_item, request.user)
        return Response(
            {
                "stock_item": StockItemDetailSerializer(reloaded_stock_item).data,
                "movement": _movement_summary(movement),
                "changed": movement is not None,
            },
            status=status.HTTP_200_OK,
        )
