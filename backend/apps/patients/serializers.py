from datetime import date

from rest_framework import serializers

from .models import Patient, PatientNote


class PatientSearchQuerySerializer(serializers.Serializer):
    q = serializers.CharField(min_length=2, max_length=100, trim_whitespace=True)


class PatientNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.get_full_name", read_only=True)

    class Meta:
        model = PatientNote
        fields = ["id", "patient", "author", "author_name", "category", "text", "created_at"]
        read_only_fields = ["author"]


class PatientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    age = serializers.SerializerMethodField()
    active_dosette_count = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id", "patient_id", "first_name", "last_name", "full_name", "age",
            "date_of_birth", "address_line", "postcode", "phone",
            "gp_practice", "gp_name", "allergies", "special_instructions",
            "status", "is_dosette", "active_dosette_count",
            "created_at", "updated_at",
        ]

    def get_age(self, obj) -> int:
        today = date.today()
        b = obj.date_of_birth
        return today.year - b.year - ((today.month, today.day) < (b.month, b.day))

    def get_active_dosette_count(self, obj) -> int:
        annotated = getattr(obj, "_active_dosette_count", None)
        if annotated is not None:
            return annotated
        return obj.dosette_plans.filter(is_active=True).count()


class PatientSearchSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    age = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id", "patient_id", "first_name", "last_name", "full_name",
            "date_of_birth", "age", "postcode", "gp_practice", "status",
            "is_dosette",
        ]

    def get_age(self, obj) -> int:
        today = date.today()
        born = obj.date_of_birth
        return today.year - born.year - (
            (today.month, today.day) < (born.month, born.day)
        )


class PatientDetailSerializer(PatientSerializer):
    notes = PatientNoteSerializer(many=True, read_only=True)

    class Meta(PatientSerializer.Meta):
        fields = PatientSerializer.Meta.fields + ["notes"]
