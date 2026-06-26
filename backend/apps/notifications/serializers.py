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


class WorkQueueSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField(read_only=True)
    urgent = serializers.IntegerField(read_only=True)
    due_soon = serializers.IntegerField(read_only=True)
    waiting_check = serializers.IntegerField(read_only=True)
    stock_action = serializers.IntegerField(read_only=True)
    reviews = serializers.IntegerField(read_only=True)


class WorkQueueItemSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    type = serializers.CharField(read_only=True)
    group = serializers.CharField(read_only=True)
    priority = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    reason = serializers.CharField(read_only=True)
    pharmacy_id = serializers.IntegerField(read_only=True)
    pharmacy_name = serializers.CharField(read_only=True, allow_blank=True)
    patient_reference = serializers.CharField(read_only=True, allow_blank=True)
    cycle_id = serializers.IntegerField(read_only=True, allow_null=True)
    cycle_reference = serializers.CharField(
        read_only=True,
        allow_blank=True,
        allow_null=True,
    )
    cycle_display_label = serializers.CharField(read_only=True, allow_blank=True)
    cycle_start_date = serializers.DateField(read_only=True, allow_null=True)
    cycle_end_date = serializers.DateField(read_only=True, allow_null=True)
    due_date = serializers.DateField(read_only=True, allow_null=True)
    status = serializers.CharField(read_only=True)
    action_label = serializers.CharField(read_only=True)
    action_href = serializers.CharField(read_only=True)


class WorkQueueResponseSerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField(read_only=True)
    summary = WorkQueueSummarySerializer(read_only=True)
    items = WorkQueueItemSerializer(many=True, read_only=True)


class AlertDismissSerializer(serializers.Serializer):
    fingerprint = serializers.CharField(max_length=255)


class AlertClearSerializer(serializers.Serializer):
    fingerprints = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        allow_empty=True,
    )


class AlertDismissResponseSerializer(serializers.Serializer):
    fingerprint = serializers.CharField(read_only=True)
    dismissed = serializers.BooleanField(read_only=True)
    created = serializers.BooleanField(read_only=True)
    summary = AlertSummarySerializer(read_only=True)


class AlertClearResponseSerializer(serializers.Serializer):
    dismissed_count = serializers.IntegerField(read_only=True)
    created_count = serializers.IntegerField(read_only=True)
    summary = AlertSummarySerializer(read_only=True)
