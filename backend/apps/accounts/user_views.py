from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.tenancy.permissions import Action, require

from .selectors import users_visible_to
from .serializers import (
    MembershipAssignmentSerializer,
    PasswordResetSerializer,
    UserCreateSerializer,
    UserReadSerializer,
    UserUpdateSerializer,
)
from .services import reassign_membership


class UserListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [require(Action.USER_CREATE)()]
        return [require(Action.USER_MANAGE)()]

    def get(self, request):
        users = users_visible_to(request.user).order_by("id")
        return Response(UserReadSerializer(users, many=True).data)

    def post(self, request):
        serializer = UserCreateSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            new_user = serializer.save()
            role = serializer.validated_data["role"]
            pharmacy = serializer.validated_data.get("pharmacy")
            pharmacy_id = pharmacy.id if pharmacy else None
            record(
                action=AuditAction.USER_CREATED,
                actor=request.user,
                target=new_user,
                request=request,
                metadata={
                    "role": role,
                    "pharmacy_id": pharmacy_id,
                },
            )

        return Response(
            UserReadSerializer(new_user).data,
            status=status.HTTP_201_CREATED,
        )


class UserDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "DELETE":
            return [require(Action.USER_DELETE)()]
        return [require(Action.USER_MANAGE)()]

    def get_object(self, request, pk):
        return get_object_or_404(users_visible_to(request.user), pk=pk)

    def get(self, request, pk: int):
        user = self.get_object(request, pk)
        return Response(UserReadSerializer(user).data)

    def patch(self, request, pk: int):
        user = self.get_object(request, pk)
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserReadSerializer(user).data)

    def delete(self, request, pk: int):
        user = self.get_object(request, pk)
        if user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot delete yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            record(
                action=AuditAction.USER_DELETED,
                actor=request.user,
                target=user,
                request=request,
                metadata={"email": user.email},
            )
            user.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class UserDeactivateView(APIView):
    permission_classes = [require(Action.USER_DEACTIVATE)]

    def post(self, request, pk: int):
        user = get_object_or_404(users_visible_to(request.user), pk=pk)
        if user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot deactivate yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user.is_active = False
            user.save(update_fields=["is_active"])
            record(
                action=AuditAction.USER_DEACTIVATED,
                actor=request.user,
                target=user,
                request=request,
            )

        return Response(UserReadSerializer(user).data)


class UserResetPasswordView(APIView):
    permission_classes = [require(Action.USER_RESET_PASSWORD)]

    def post(self, request, pk: int):
        user = get_object_or_404(users_visible_to(request.user), pk=pk)
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_password = serializer.validated_data["new_password"]

        with transaction.atomic():
            user.set_password(new_password)
            user.must_change_password = True
            user.save(update_fields=["password", "must_change_password"])
            record(
                action=AuditAction.PASSWORD_RESET,
                actor=request.user,
                target=user,
                request=request,
            )

        return Response({"detail": "Password reset."})


class AssignMembershipView(APIView):
    permission_classes = [require(Action.USER_ASSIGN_ROLE)]

    def post(self, request, pk: int):
        target = get_object_or_404(users_visible_to(request.user), pk=pk)
        if target.pk == request.user.pk:
            return Response(
                {"detail": "You cannot reassign your own membership."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = MembershipAssignmentSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        try:
            reassign_membership(
                target_user=target,
                role=serializer.validated_data["role"],
                group=serializer.validated_data.get("group"),
                pharmacy=serializer.validated_data.get("pharmacy"),
                pharmacies=serializer.validated_data.get("pharmacies"),
                actor=request.user,
                request=request,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict or exc.messages) from exc

        target.refresh_from_db()
        return Response(UserReadSerializer(target).data)
