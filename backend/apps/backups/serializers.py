from rest_framework import serializers

from .models import BackupRun, BackupSchedule


class BackupScheduleSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    scheduler_note = serializers.SerializerMethodField()

    class Meta:
        model = BackupSchedule
        fields = [
            "id",
            "group",
            "group_name",
            "enabled",
            "daily_time",
            "retention_count",
            "scheduler_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "group",
            "group_name",
            "retention_count",
            "scheduler_note",
            "created_at",
            "updated_at",
        ]

    def get_scheduler_note(self, _obj):
        return "Scheduled backups run when the scheduler command is active."


class BackupRunSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = BackupRun
        fields = [
            "id",
            "group",
            "group_name",
            "status",
            "trigger",
            "file",
            "file_size",
            "started_at",
            "completed_at",
            "error_message",
            "checksum",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
