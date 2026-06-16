from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.tenancy.models import Group, Membership, Pharmacy, Role
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


class MembershipAssignmentSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices)
    group_id = serializers.IntegerField(required=False, allow_null=True)
    pharmacy_id = serializers.IntegerField(required=False, allow_null=True)
    pharmacy_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )

    def validate(self, attrs):
        requester = self.context["request"].user
        scope = resolve_scope(requester)
        membership = get_active_membership(requester)
        role = attrs["role"]
        group_id = attrs.get("group_id")
        pharmacy_id = attrs.get("pharmacy_id")
        pharmacy_ids = attrs.get("pharmacy_ids", [])
        group = None
        pharmacy = None
        pharmacies = []

        if scope.is_global:
            group, pharmacy, pharmacies = self._validate_global_scope(
                role,
                group_id,
                pharmacy_id,
                pharmacy_ids,
            )
        else:
            group, pharmacy, pharmacies = self._validate_pharmacist_scope(
                membership,
                role,
                group_id,
                pharmacy_id,
                pharmacy_ids,
            )

        attrs["group"] = group
        attrs["pharmacy"] = pharmacy
        attrs["pharmacies"] = pharmacies
        return attrs

    def _get_group(self, group_id):
        try:
            return Group.objects.get(pk=group_id)
        except Group.DoesNotExist as exc:
            raise serializers.ValidationError({"group_id": "Invalid group."}) from exc

    def _get_pharmacy(self, pharmacy_id):
        try:
            return Pharmacy.objects.get(pk=pharmacy_id)
        except Pharmacy.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"pharmacy_id": "Invalid pharmacy."}
            ) from exc

    def _get_pharmacies(self, pharmacy_ids):
        pharmacies = list(Pharmacy.objects.filter(pk__in=pharmacy_ids))
        if len(pharmacies) != len(set(pharmacy_ids)):
            raise serializers.ValidationError(
                {"pharmacy_ids": "One or more pharmacies are invalid."}
            )
        return pharmacies

    def _validate_global_scope(self, role, group_id, pharmacy_id, pharmacy_ids):
        if role == Role.ADMIN:
            if group_id is not None or pharmacy_id is not None or pharmacy_ids:
                raise serializers.ValidationError(
                    "Admin memberships must not have a scope."
                )
            return None, None, []

        if role == Role.SUPERINTENDENT:
            if group_id is None or pharmacy_id is not None or pharmacy_ids:
                raise serializers.ValidationError(
                    "Superintendent memberships require only a group."
                )
            return self._get_group(group_id), None, []

        if role == Role.STOCK_EMPLOYEE:
            if group_id is None or pharmacy_id is not None:
                raise serializers.ValidationError(
                    "Stock employee memberships require a group and selected "
                    "pharmacies."
                )
            group = self._get_group(group_id)
            pharmacies = self._get_pharmacies(pharmacy_ids)
            if any(pharmacy.group_id != group.id for pharmacy in pharmacies):
                raise serializers.ValidationError(
                    {"pharmacy_ids": "Selected pharmacies must belong to the group."}
                )
            return group, None, pharmacies

        if role in {Role.PHARMACIST, Role.DISPENSER}:
            if pharmacy_id is None or group_id is not None or pharmacy_ids:
                raise serializers.ValidationError(
                    f"{role.title()} memberships require only a pharmacy."
                )
            return None, self._get_pharmacy(pharmacy_id), []

        raise serializers.ValidationError({"role": "Invalid role."})

    def _validate_pharmacist_scope(
        self,
        membership,
        role,
        group_id,
        pharmacy_id,
        pharmacy_ids,
    ):
        if membership is None or membership.role != Role.PHARMACIST:
            raise PermissionDenied("You do not have permission to assign memberships.")
        if role not in {Role.PHARMACIST, Role.DISPENSER}:
            raise PermissionDenied("You can only assign pharmacy-scoped roles.")
        if group_id is not None or pharmacy_ids:
            raise PermissionDenied("You cannot assign group-scoped memberships.")
        if pharmacy_id != membership.pharmacy_id:
            raise PermissionDenied("You can only assign users in your pharmacy.")
        return None, membership.pharmacy, []
