from rest_framework import serializers

from .models import Patient, PatientNote


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

    def get_age(self, obj):
        from datetime import date
        today = date.today()
        b = obj.date_of_birth
        return today.year - b.year - ((today.month, today.day) < (b.month, b.day))

    def get_active_dosette_count(self, obj):
        return obj.dosette_plans.filter(is_active=True).count() if hasattr(obj, "dosette_plans") else 0


class PatientDetailSerializer(PatientSerializer):
    notes = PatientNoteSerializer(many=True, read_only=True)

    class Meta(PatientSerializer.Meta):
        fields = PatientSerializer.Meta.fields + ["notes"]
