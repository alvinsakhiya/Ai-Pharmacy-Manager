from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.core.models import AuditLog

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    display_role = serializers.CharField(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "full_name",
            "role", "display_role", "job_title", "gphc_number",
            "is_active", "last_login", "date_joined",
        ]
        read_only_fields = ["id", "last_login", "date_joined"]

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.username


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "job_title", "gphc_number", "is_active", "password",
        ]

    def create(self, validated_data):
        from django.utils.crypto import get_random_string

        password = validated_data.pop("password", None)
        user = User(**validated_data)
        user.set_password(password or get_random_string(16))
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class LoginSerializer(TokenObtainPairSerializer):
    """JWT login that also returns the user profile and embeds the role claim."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["name"] = user.get_full_name() or user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id", "actor", "actor_label", "action", "entity",
            "entity_id", "summary", "detail", "timestamp",
        ]
