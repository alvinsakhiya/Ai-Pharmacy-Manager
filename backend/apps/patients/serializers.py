from rest_framework import serializers

from apps.tenancy.permissions import Action, can

from .models import Patient


class PatientSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField()

    class Meta:
        model = Patient
        fields = [
            "id",
            "pharmacy",
            "patient_reference",
            "first_name",
            "last_name",
            "date_of_birth",
            "address",
            "postcode",
            "phone",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]
        validators: list[object] = []

    def validate(self, attrs):
        request = self.context.get("request")
        pharmacy = attrs.get("pharmacy", getattr(self.instance, "pharmacy", None))
        patient_reference = attrs.get(
            "patient_reference",
            getattr(self.instance, "patient_reference", None),
        )

        if self.instance is None:
            if pharmacy is None:
                raise serializers.ValidationError(
                    {"pharmacy": ["This field is required."]}
                )
            if request is not None and not can(
                request.user,
                Action.PATIENT_MANAGE,
                target=pharmacy,
            ):
                raise serializers.ValidationError(
                    {"pharmacy": ["This pharmacy is outside your patient scope."]}
                )
        elif (
            "pharmacy" in attrs
            and attrs["pharmacy"] is not None
            and attrs["pharmacy"] != self.instance.pharmacy
        ):
            raise serializers.ValidationError(
                {"pharmacy": ["Patient pharmacy cannot be changed."]}
            )

        if pharmacy is not None and patient_reference:
            queryset = Patient.objects.filter(
                pharmacy=pharmacy,
                patient_reference=patient_reference,
            )
            if self.instance is not None:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "patient_reference": [
                            "A patient with this reference already exists in this "
                            "pharmacy."
                        ]
                    }
                )

        return attrs
