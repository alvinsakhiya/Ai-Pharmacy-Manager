from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from auditlog.models import AuditEvent
from auditlog.services import log_audit_event
from .serializers import AuditedTokenObtainPairSerializer
from .roles import user_access_payload


class AuditedTokenObtainPairView(TokenObtainPairView):
    serializer_class = AuditedTokenObtainPairSerializer


@api_view(["GET"])
def current_user_view(request):
    return Response(user_access_payload(request.user))


@api_view(["POST"])
def logout_view(request):
    log_audit_event(
        action=AuditEvent.Action.LOGOUT,
        entity_type="StaffSession",
        entity_identifier=request.user.pk,
        summary="Ended local staff session.",
        request=request,
    )
    return Response(status=status.HTTP_204_NO_CONTENT)
