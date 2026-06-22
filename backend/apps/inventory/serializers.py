from datetime import date

from rest_framework import serializers

from apps.catalogue.models import CatalogueProduct, Medication
from apps.tenancy.models import Pharmacy
from apps.tenancy.permissions import Action, can

from .models import StockBatch, StockItem


class StockBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockBatch
        fields = [
            "id",
            "batch_number",
            "expiry_date",
            "quantity",
            "quantity_received",
            "received_at",
            "is_active",
        ]
        read_only_fields = fields


class StockItemSerializer(serializers.ModelSerializer):
    medication_name = serializers.CharField(source="medication.name", read_only=True)
    quantity_on_hand = serializers.IntegerField(read_only=True)
    earliest_expiry = serializers.DateField(allow_null=True, read_only=True)

    class Meta:
        model = StockItem
        fields = [
            "id",
            "pharmacy",
            "medication",
            "medication_name",
            "unit_price",
            "reorder_level",
            "is_active",
            "quantity_on_hand",
            "earliest_expiry",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class StockItemDetailSerializer(StockItemSerializer):
    batches = StockBatchSerializer(many=True, read_only=True)

    class Meta(StockItemSerializer.Meta):
        fields = [*StockItemSerializer.Meta.fields, "batches"]
        read_only_fields = fields


class ReceiveStockSerializer(serializers.Serializer):
    pharmacy = serializers.PrimaryKeyRelatedField(queryset=Pharmacy.objects.all())
    medication = serializers.PrimaryKeyRelatedField(queryset=Medication.objects.all())
    batch_number = serializers.CharField(max_length=64)
    expiry_date = serializers.DateField()
    quantity = serializers.IntegerField(min_value=1)
    received_at = serializers.DateField(required=False)
    unit_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reference = serializers.CharField(max_length=128, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get("request")
        pharmacy = attrs["pharmacy"]
        medication = attrs["medication"]
        received_at = attrs.get("received_at") or date.today()
        expiry_date = attrs["expiry_date"]

        if request is not None and not can(
            request.user,
            Action.STOCK_MANAGE,
            target=pharmacy,
        ):
            raise serializers.ValidationError(
                {"pharmacy": ["This pharmacy is outside your stock scope."]}
            )

        if medication.group_id != pharmacy.group_id:
            raise serializers.ValidationError(
                {"medication": ["Medication does not belong to this pharmacy's group."]}
            )

        if expiry_date < received_at:
            raise serializers.ValidationError(
                {"expiry_date": ["Expiry date cannot be before the received date."]}
            )

        attrs["received_at"] = received_at
        return attrs


class CatalogueStockIntakeSerializer(serializers.Serializer):
    pharmacy = serializers.PrimaryKeyRelatedField(queryset=Pharmacy.objects.all())
    catalogue_product = serializers.PrimaryKeyRelatedField(
        queryset=CatalogueProduct.objects.filter(is_active=True)
    )
    packs_received = serializers.IntegerField(min_value=1)
    batch_number = serializers.CharField(max_length=64)
    expiry_date = serializers.DateField()
    received_at = serializers.DateField(required=False)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reference = serializers.CharField(max_length=128, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get("request")
        pharmacy = attrs["pharmacy"]
        product = attrs["catalogue_product"]
        received_at = attrs.get("received_at") or date.today()
        expiry_date = attrs["expiry_date"]

        if request is not None and not can(
            request.user,
            Action.STOCK_RECEIVE,
            target=pharmacy,
        ):
            raise serializers.ValidationError(
                {"pharmacy": ["This pharmacy is outside your stock receiving scope."]}
            )

        if expiry_date < date.today():
            raise serializers.ValidationError(
                {"expiry_date": ["Expiry date cannot be in the past."]}
            )

        if expiry_date < received_at:
            raise serializers.ValidationError(
                {"expiry_date": ["Expiry date cannot be before the received date."]}
            )

        pack_size = product.pack_size or 1
        attrs["received_at"] = received_at
        attrs["pack_size_snapshot"] = pack_size
        attrs["pack_unit_snapshot"] = product.pack_unit
        attrs["quantity"] = attrs["packs_received"] * pack_size
        return attrs


class AdjustStockSerializer(serializers.Serializer):
    delta = serializers.IntegerField()
    reason = serializers.CharField(max_length=255)
    reference = serializers.CharField(max_length=128, required=False, allow_blank=True)

    def validate_delta(self, value):
        if value == 0:
            raise serializers.ValidationError("Adjustment delta cannot be zero.")
        return value


class CountStockSerializer(serializers.Serializer):
    counted_quantity = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reference = serializers.CharField(max_length=128, required=False, allow_blank=True)


class TransferStockSerializer(serializers.Serializer):
    destination_pharmacy = serializers.PrimaryKeyRelatedField(
        queryset=Pharmacy.objects.all()
    )
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reference = serializers.CharField(max_length=128, required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context.get("request")
        destination_pharmacy = attrs["destination_pharmacy"]

        if request is not None and not can(
            request.user,
            Action.STOCK_TRANSFER,
            target=destination_pharmacy,
        ):
            raise serializers.ValidationError(
                {"destination_pharmacy": ["This pharmacy is outside your stock scope."]}
            )

        return attrs
