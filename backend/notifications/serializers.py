from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    assigned_user = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    assigned_user_display = serializers.SerializerMethodField()
    priority_label = serializers.CharField(
        source="get_priority_display",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    is_expired = serializers.BooleanField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "title",
            "message",
            "priority",
            "priority_label",
            "status",
            "status_label",
            "assigned_user",
            "assigned_user_display",
            "due_date",
            "expiry_date",
            "related_entity_type",
            "related_entity_id",
            "created_at",
            "acknowledged_at",
            "resolved_at",
            "resolution_reason",
            "is_expired",
            "is_overdue",
        )
        read_only_fields = (
            "id",
            "priority_label",
            "status",
            "status_label",
            "assigned_user_display",
            "created_at",
            "acknowledged_at",
            "resolved_at",
            "resolution_reason",
            "is_expired",
            "is_overdue",
        )

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Notification title is required.")
        return value

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Notification message is required.")
        if len(value) > 3000:
            raise serializers.ValidationError(
                "Notification message cannot exceed 3,000 characters."
            )
        return value

    def validate(self, attrs):
        due_date = attrs.get(
            "due_date",
            getattr(self.instance, "due_date", None),
        )
        expiry_date = attrs.get(
            "expiry_date",
            getattr(self.instance, "expiry_date", None),
        )
        related_type = attrs.get(
            "related_entity_type",
            getattr(self.instance, "related_entity_type", ""),
        ).strip()
        related_id = attrs.get(
            "related_entity_id",
            getattr(self.instance, "related_entity_id", ""),
        ).strip()

        if due_date and expiry_date and due_date > expiry_date:
            raise serializers.ValidationError(
                {"expiry_date": "Expiry date cannot be before the due date."}
            )

        if bool(related_type) != bool(related_id):
            raise serializers.ValidationError(
                {
                    "related_entity_id": (
                        "Related entity type and identifier must be provided together."
                    )
                }
            )

        attrs["related_entity_type"] = related_type
        attrs["related_entity_id"] = related_id
        return attrs

    def create(self, validated_data):
        assigned_user = validated_data.get("assigned_user")
        validated_data["assigned_username"] = (
            assigned_user.get_username() if assigned_user else ""
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "assigned_user" in validated_data:
            assigned_user = validated_data["assigned_user"]
            validated_data["assigned_username"] = (
                assigned_user.get_username() if assigned_user else ""
            )
        return super().update(instance, validated_data)

    def get_assigned_user_display(self, obj):
        if obj.assigned_username:
            return obj.assigned_username
        if obj.assigned_user:
            return obj.assigned_user.get_username()
        return "All authorised staff"


class ResolutionSerializer(serializers.Serializer):
    resolution_reason = serializers.CharField(
        max_length=500,
        trim_whitespace=True,
        allow_blank=False,
    )
