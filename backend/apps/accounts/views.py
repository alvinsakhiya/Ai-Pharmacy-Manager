from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.tenancy.models import Pharmacy
from apps.tenancy.permissions import Action, can
from apps.tenancy.policy import get_active_membership, resolve_scope

from .serializers import LoginSerializer, PasswordChangeSerializer


def build_me_payload(user, request=None) -> dict:
    active_membership = get_active_membership(user)
    scope = resolve_scope(user)

    if scope.is_global:
        pharmacies = Pharmacy.objects.filter(is_active=True)
    else:
        pharmacies = Pharmacy.objects.filter(
            id__in=scope.pharmacy_ids,
            is_active=True,
        )

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "must_change_password": user.must_change_password,
        "role": active_membership.role if active_membership else None,
        "scope": {
            "is_global": scope.is_global,
            "group_ids": sorted(scope.group_ids),
            "pharmacy_ids": sorted(scope.pharmacy_ids),
        },
        "pharmacies": [
            {"id": pharmacy.id, "name": pharmacy.name}
            for pharmacy in pharmacies.order_by("id")
        ],
        "permissions": {action.value: can(user, action) for action in Action},
    }


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set"})


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user)
        return Response(build_me_payload(user, request))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"detail": "Logged out."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_me_payload(request.user, request))


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        old_password = serializer.validated_data["old_password"]
        new_password = serializer.validated_data["new_password"]

        if not user.check_password(old_password):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user.set_password(new_password)
            user.must_change_password = False
            user.save()
            record(
                action=AuditAction.PASSWORD_CHANGED,
                actor=user,
                request=request,
            )

        update_session_auth_hash(request, user)
        return Response({"detail": "Password changed."})
