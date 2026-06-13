from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from auditlog.models import AuditEvent
from auditlog.services import log_audit_event
from .roles import user_access_payload


class AuditedTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        log_audit_event(
            action=AuditEvent.Action.LOGIN,
            entity_type="StaffSession",
            entity_identifier=self.user.pk,
            summary="Authenticated staff session.",
            request=self.context.get("request"),
            actor=self.user,
        )
        data["user"] = user_access_payload(self.user)
        return data
