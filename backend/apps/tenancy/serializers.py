from rest_framework import serializers

from .models import Group, Pharmacy


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "slug",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_slug(self, value: str) -> str:
        queryset = Group.objects.filter(slug=value)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("A group with this slug already exists.")
        return value


class PharmacySerializer(serializers.ModelSerializer):
    class Meta:
        model = Pharmacy
        fields = [
            "id",
            "group",
            "name",
            "code",
            "address",
            "postcode",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators: list[object] = []

    def validate(self, attrs):
        group = attrs.get("group", getattr(self.instance, "group", None))
        code = attrs.get("code", getattr(self.instance, "code", None))
        if group is not None and code is not None:
            queryset = Pharmacy.objects.filter(group=group, code=code)
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"code": "A pharmacy with this code already exists in this group."}
                )
        return attrs
