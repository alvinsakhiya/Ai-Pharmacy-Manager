from django.contrib.auth import get_user_model
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.core.audit import record
from apps.core.models import AuditLog
from apps.core.permissions import IsAdministrator

from .serializers import (
    AuditLogSerializer,
    LoginSerializer,
    UserSerializer,
    UserWriteSerializer,
)

User = get_user_model()


class LoginView(TokenObtainPairView):
    """POST username/password -> {access, refresh, user}. Logged to audit trail."""

    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = request.data.get("username")
            user = User.objects.filter(username=username).first()
            record("login", "accounts.User", entity_id=getattr(user, "id", ""),
                   summary=f"{username} signed in", actor=user)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserViewSet(viewsets.ModelViewSet):
    """Administrator-only staff management."""

    queryset = User.objects.all().order_by("first_name", "last_name")
    permission_classes = [IsAdministrator]
    filterset_fields = ["role", "is_active"]
    search_fields = ["username", "first_name", "last_name", "email"]

    def get_serializer_class(self):
        return UserWriteSerializer if self.action in {"create", "update", "partial_update"} else UserSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit trail. Visible to pharmacists & administrators."""

    queryset = AuditLog.objects.select_related("actor").all()
    serializer_class = AuditLogSerializer
    filterset_fields = ["action", "entity", "actor"]
    search_fields = ["summary", "actor_label", "entity"]

    def get_permissions(self):
        from apps.core.permissions import IsPharmacistOrAdmin
        return [IsPharmacistOrAdmin()]
