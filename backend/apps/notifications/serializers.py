from rest_framework import serializers


class AlertSummaryByCategorySerializer(serializers.Serializer):
    stock = serializers.IntegerField(read_only=True)
    dosette = serializers.IntegerField(read_only=True)


class AlertSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField(read_only=True)
    critical = serializers.IntegerField(read_only=True)
    warning = serializers.IntegerField(read_only=True)
    info = serializers.IntegerField(read_only=True)
    by_category = AlertSummaryByCategorySerializer(read_only=True)


class AlertSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    category = serializers.CharField(read_only=True)
    type = serializers.CharField(read_only=True)
    severity = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    message = serializers.CharField(read_only=True)
    pharmacy_id = serializers.IntegerField(read_only=True)
    subject = serializers.DictField(read_only=True)


class AlertsResponseSerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField(read_only=True)
    summary = AlertSummarySerializer(read_only=True)
    alerts = AlertSerializer(many=True, read_only=True)
