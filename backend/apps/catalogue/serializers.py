from rest_framework import serializers

from .models import CatalogueProduct, Medication
from .selectors import effective_group_ids
from .services import get_or_create_medication_from_product


class CatalogueProductSerializer(serializers.ModelSerializer):
    full_label = serializers.CharField(read_only=True)

    class Meta:
        model = CatalogueProduct
        fields = [
            "id",
            "dmd_code",
            "source",
            "dmd_type",
            "parent_dmd_code",
            "vmp_name",
            "amp_name",
            "display_name",
            "ingredient",
            "strength",
            "dose_form",
            "pack_size",
            "pack_unit",
            "manufacturer",
            "appearance_colour",
            "appearance_shape",
            "appearance_form",
            "release_version",
            "release_file",
            "full_label",
            "is_active",
            "is_discontinued",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class MedicationSerializer(serializers.ModelSerializer):
    catalogue_product_full_label = serializers.SerializerMethodField()
    catalogue_product_pack_size = serializers.SerializerMethodField()
    catalogue_product_pack_unit = serializers.SerializerMethodField()

    class Meta:
        model = Medication
        fields = [
            "id",
            "group",
            "catalogue_product",
            "catalogue_product_full_label",
            "catalogue_product_pack_size",
            "catalogue_product_pack_unit",
            "name",
            "form",
            "strength",
            "manufacturer",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "catalogue_product_full_label",
            "catalogue_product_pack_size",
            "catalogue_product_pack_unit",
            "name",
            "form",
            "strength",
            "manufacturer",
            "created_at",
            "updated_at",
        ]
        validators: list[object] = []
        extra_kwargs = {
            "catalogue_product": {
                "queryset": CatalogueProduct.objects.filter(is_active=True),
                "required": False,
                "allow_null": True,
            },
        }

    def validate(self, attrs):
        request = self.context.get("request")
        group = attrs.get("group", getattr(self.instance, "group", None))

        if request is not None and group is not None:
            group_ids = effective_group_ids(request.user)
            if group_ids is not None and group.id not in group_ids:
                raise serializers.ValidationError(
                    {"group": "This group is outside your catalogue scope."}
                )

        if self.instance is None:
            if attrs.get("catalogue_product") is None:
                raise serializers.ValidationError(
                    {"catalogue_product": "Select a catalogue product."}
                )
        else:
            locked_fields = {
                "group",
                "catalogue_product",
                "name",
                "form",
                "strength",
                "manufacturer",
            }
            attempted = locked_fields.intersection(self.initial_data.keys())
            if attempted:
                raise serializers.ValidationError(
                    {
                        field: "This field is derived from the catalogue product."
                        for field in attempted
                    }
                )

        return attrs

    def get_catalogue_product_full_label(self, obj):
        if obj.catalogue_product is None:
            return None
        return obj.catalogue_product.full_label

    def get_catalogue_product_pack_size(self, obj):
        if obj.catalogue_product is None:
            return None
        return obj.catalogue_product.pack_size

    def get_catalogue_product_pack_unit(self, obj):
        if obj.catalogue_product is None:
            return ""
        return obj.catalogue_product.pack_unit

    def create(self, validated_data):
        group = validated_data["group"]
        product = validated_data["catalogue_product"]
        notes = validated_data.get("notes", "")
        is_active = validated_data.get("is_active", True)

        medication = get_or_create_medication_from_product(group, product)
        update_fields = []
        if medication.notes != notes:
            medication.notes = notes
            update_fields.append("notes")
        if medication.is_active != is_active:
            medication.is_active = is_active
            update_fields.append("is_active")

        if update_fields:
            update_fields.append("updated_at")
            medication.save(update_fields=update_fields)

        return medication

    def update(self, instance, validated_data):
        instance.notes = validated_data.get("notes", instance.notes)
        instance.is_active = validated_data.get("is_active", instance.is_active)
        instance.save(update_fields=["notes", "is_active", "updated_at"])
        return instance
