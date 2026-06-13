from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_display = serializers.SerializerMethodField()
    action_label = serializers.CharField(
        source="get_action_display",
        read_only=True,
    )

    class Meta:
        model = AuditEvent
        fields = (
            "id",
            "actor_display",
            "action",
            "action_label",
            "entity_type",
            "entity_identifier",
            "timestamp",
            "summary",
            "request_path",
        )
        read_only_fields = fields

    def get_actor_display(self, obj):
        return obj.actor_username or "System"
