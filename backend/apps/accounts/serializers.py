from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.tenancy.models import Membership, Pharmacy, Role
from apps.tenancy.policy import get_active_membership, resolve_scope

from .models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value: str) -> str:
        validate_password(value)
        return value


class UserReadSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    pharmacy = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "is_active",
            "must_change_password",
            "role",
            "pharmacy",
            "date_joined",
        ]

    def _active_membership(self, obj):
        return obj.memberships.filter(is_active=True).select_related("pharmacy").first()

    def get_role(self, obj):
        membership = self._active_membership(obj)
        return membership.role if membership else None

    def get_pharmacy(self, obj):
        membership = self._active_membership(obj)
        if membership is None or membership.pharmacy is None:
            return None
        return {"id": membership.pharmacy.id, "name": membership.pharmacy.name}


class UserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255, allow_blank=True, required=False)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    role = serializers.ChoiceField(choices=Role.choices)
    pharmacy_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def validate_email(self, value: str) -> str:
        normalized_email = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized_email

    def validate(self, attrs):
        request = self.context["request"]
        requester = request.user
        scope = resolve_scope(requester)
        role = attrs["role"]
        pharmacy_id = attrs.get("pharmacy_id")
        pharmacy = None

        if pharmacy_id is not None:
            try:
                pharmacy = Pharmacy.objects.get(pk=pharmacy_id)
            except Pharmacy.DoesNotExist as exc:
                raise serializers.ValidationError(
                    {"pharmacy_id": "Invalid pharmacy."}
                ) from exc

        if scope.is_global:
            if role != Role.ADMIN and pharmacy is None:
                raise serializers.ValidationError(
                    {"pharmacy_id": "This role requires a pharmacy."}
                )
        else:
            membership = get_active_membership(requester)
            if membership is None or membership.role != Role.PHARMACIST:
                raise PermissionDenied("You do not have permission to create users.")
            if role not in {Role.PHARMACIST, Role.DISPENSER}:
                raise PermissionDenied("You can only create pharmacy-scoped users.")
            if pharmacy_id != membership.pharmacy_id:
                raise PermissionDenied("You can only create users in your pharmacy.")
            pharmacy = membership.pharmacy

        attrs["pharmacy"] = pharmacy
        return attrs

    def create(self, validated_data):
        role = validated_data["role"]
        pharmacy = validated_data.get("pharmacy")
        password = validated_data["password"]

        with transaction.atomic():
            user = User(
                email=User.objects.normalize_email(validated_data["email"]),
                full_name=validated_data.get("full_name", ""),
                must_change_password=True,
            )
            user.set_password(password)
            user.save()

            membership_kwargs = {"user": user, "role": role}
            if role in {Role.SUPERINTENDENT, Role.STOCK_EMPLOYEE}:
                membership_kwargs["group"] = pharmacy.group if pharmacy else None
            elif role in {Role.PHARMACIST, Role.DISPENSER}:
                membership_kwargs["pharmacy"] = pharmacy
            membership = Membership(**membership_kwargs)
            membership.full_clean()
            membership.save()

        return user


class UserUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, allow_blank=True)

    def update(self, instance, validated_data):
        if "full_name" in validated_data:
            instance.full_name = validated_data["full_name"]
            instance.save(update_fields=["full_name"])
        return instance


class PasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value: str) -> str:
        validate_password(value)
        return value
