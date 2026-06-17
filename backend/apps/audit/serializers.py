from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "action",
            "actor_email",
            "actor_role",
            "group",
            "pharmacy",
            "target_type",
            "target_id",
            "metadata",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = fields
