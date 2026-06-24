from rest_framework import serializers

from apps.tenancy.permissions import Action, can

from .models import Patient, PatientGp, PatientNote


class PatientGpSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientGp
        fields = [
            "doctor_name",
            "practice_name",
            "practice_address",
            "practice_postcode",
            "practice_phone",
            "practice_email",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class PatientSerializer(serializers.ModelSerializer):
    date_of_birth = serializers.DateField()
    title = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=20
    )
    gender = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=40
    )
    email = serializers.EmailField(
        required=False, allow_blank=True, allow_null=True, max_length=254
    )
    gp = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id",
            "pharmacy",
            "patient_reference",
            "title",
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
            "address",
            "postcode",
            "phone",
            "email",
            "notes",
            "gp",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]
        validators: list[object] = []

    def get_gp(self, obj: Patient) -> dict | None:
        gp = PatientGp.objects.filter(patient=obj).first()
        if gp is None:
            return None
        return PatientGpSerializer(gp).data

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


class PatientNoteSerializer(serializers.ModelSerializer):
    body = serializers.CharField(allow_blank=True)

    class Meta:
        model = PatientNote
        fields = ["id", "body", "author", "author_email", "created_at"]
        read_only_fields = ["id", "author", "author_email", "created_at"]

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError("Note body is required.")
        return value
