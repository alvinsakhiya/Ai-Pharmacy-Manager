from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import OpeningHour, OperationalTask


class OperationalTaskSerializer(serializers.ModelSerializer):
    assigned_user = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    assigned_user_display = serializers.SerializerMethodField()
    created_by_display = serializers.SerializerMethodField()
    category_label = serializers.CharField(
        source="get_category_display",
        read_only=True,
    )
    priority_label = serializers.CharField(
        source="get_priority_display",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = OperationalTask
        fields = (
            "id",
            "title",
            "description",
            "category",
            "category_label",
            "priority",
            "priority_label",
            "status",
            "status_label",
            "assigned_user",
            "assigned_user_display",
            "due_at",
            "created_by_display",
            "completed_at",
            "cancellation_reason",
            "created_at",
            "updated_at",
            "is_overdue",
        )
        read_only_fields = (
            "id",
            "category_label",
            "priority_label",
            "status",
            "status_label",
            "assigned_user_display",
            "created_by_display",
            "completed_at",
            "cancellation_reason",
            "created_at",
            "updated_at",
            "is_overdue",
        )

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Task title is required.")
        return value

    def validate_description(self, value):
        return value.strip()

    def validate(self, attrs):
        if self.instance and self.instance.status in {
            OperationalTask.Status.COMPLETED,
            OperationalTask.Status.CANCELLED,
        }:
            raise serializers.ValidationError(
                "Completed or cancelled tasks are read-only."
            )
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
        return obj.assigned_username or "Unassigned"

    def get_created_by_display(self, obj):
        return obj.created_by_username or "System"


class OpeningHourSerializer(serializers.ModelSerializer):
    day_label = serializers.CharField(
        source="get_day_of_week_display",
        read_only=True,
    )

    class Meta:
        model = OpeningHour
        fields = (
            "id",
            "day_of_week",
            "day_label",
            "opening_time",
            "closing_time",
            "is_closed",
            "notes",
            "updated_at",
        )
        read_only_fields = ("id", "day_label", "updated_at")

    def validate(self, attrs):
        is_closed = attrs.get(
            "is_closed",
            getattr(self.instance, "is_closed", False),
        )
        opening_time = attrs.get(
            "opening_time",
            getattr(self.instance, "opening_time", None),
        )
        closing_time = attrs.get(
            "closing_time",
            getattr(self.instance, "closing_time", None),
        )

        if is_closed:
            attrs["opening_time"] = None
            attrs["closing_time"] = None
        elif not opening_time or not closing_time:
            raise serializers.ValidationError(
                "Opening and closing times are required for an open day."
            )
        elif closing_time <= opening_time:
            raise serializers.ValidationError(
                {"closing_time": "Closing time must be after opening time."}
            )

        if "notes" in attrs:
            attrs["notes"] = attrs["notes"].strip()

        return attrs


class TaskCancellationSerializer(serializers.Serializer):
    reason = serializers.CharField(
        max_length=500,
        trim_whitespace=True,
        allow_blank=False,
    )
