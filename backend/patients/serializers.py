from rest_framework import serializers
from .models import ClinicalReviewNote, Patient


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = "__all__"


class ClinicalReviewNoteSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    author_display = serializers.SerializerMethodField()
    category_label = serializers.CharField(
        source="get_category_display",
        read_only=True,
    )
    follow_up_status_label = serializers.CharField(
        source="get_follow_up_status_display",
        read_only=True,
    )

    class Meta:
        model = ClinicalReviewNote
        fields = (
            "id",
            "patient",
            "patient_name",
            "author_display",
            "category",
            "category_label",
            "note_text",
            "review_date",
            "follow_up_status",
            "follow_up_status_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "patient_name",
            "author_display",
            "category_label",
            "follow_up_status_label",
            "created_at",
            "updated_at",
        )

    def validate_note_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Clinical note text is required.")
        if len(value) > 5000:
            raise serializers.ValidationError(
                "Clinical note text cannot exceed 5,000 characters."
            )
        return value

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def get_author_display(self, obj):
        return obj.author_username or "Former staff member"
