from rest_framework import serializers

from .models import Medication
from .selectors import effective_group_ids


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = [
            "id",
            "group",
            "name",
            "form",
            "strength",
            "manufacturer",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators: list[object] = []

    def validate(self, attrs):
        request = self.context.get("request")
        group = attrs.get("group", getattr(self.instance, "group", None))
        name = attrs.get("name", getattr(self.instance, "name", None))
        form = attrs.get("form", getattr(self.instance, "form", None))
        strength = attrs.get("strength", getattr(self.instance, "strength", None))

        if request is not None and group is not None:
            group_ids = effective_group_ids(request.user)
            if group_ids is not None and group.id not in group_ids:
                raise serializers.ValidationError(
                    {"group": "This group is outside your catalogue scope."}
                )

        if all(value is not None for value in [group, name, form, strength]):
            queryset = Medication.objects.filter(
                group=group,
                name=name,
                form=form,
                strength=strength,
            )
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            "A medication with this name, form, and strength "
                            "already exists in this group."
                        ]
                    }
                )

        return attrs
