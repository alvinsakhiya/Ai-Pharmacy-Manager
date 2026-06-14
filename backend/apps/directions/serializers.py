from rest_framework import serializers

from .models import TrustedDirection


class TrustedDirectionSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = TrustedDirection
        fields = ["id", "code", "text", "category", "category_display"]
