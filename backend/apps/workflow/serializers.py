from rest_framework import serializers

from .ai import suggest
from .models import JobStatus, WorkflowJob, WorkflowStatusHistory


class WorkflowJobSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_ref = serializers.CharField(source="patient.patient_id", read_only=True)
    patient_dob = serializers.DateField(source="patient.date_of_birth", read_only=True)
    job_type_display = serializers.CharField(source="get_job_type_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True)
    priority_rank = serializers.IntegerField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    days_to_due = serializers.IntegerField(read_only=True)
    ai = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowJob
        fields = [
            "id", "patient", "patient_name", "patient_ref", "patient_dob",
            "job_type", "job_type_display", "title",
            "priority", "priority_display", "priority_rank",
            "status", "status_display", "due_date", "is_overdue", "days_to_due",
            "assigned_to", "assigned_to_name", "issue_notes",
            "ai", "created_at", "updated_at",
        ]

    def get_ai(self, obj):
        return suggest(obj)


class WorkflowJobWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowJob
        fields = [
            "id", "patient", "dosette_cycle", "job_type", "title",
            "priority", "status", "due_date", "assigned_to",
        ]
        # status is set via the transition endpoints; on create it defaults to NEW.
        read_only_fields = ["status"]


class WorkflowStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowStatusHistory
        fields = [
            "id", "job", "from_status", "to_status",
            "changed_by", "changed_by_label", "note", "timestamp",
        ]


class TransitionSerializer(serializers.Serializer):
    to_status = serializers.ChoiceField(choices=JobStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")


class IssueSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=255)


class ResolveIssueSerializer(serializers.Serializer):
    to_status = serializers.ChoiceField(choices=JobStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")


class AssignSerializer(serializers.Serializer):
    assigned_to = serializers.IntegerField(required=False, allow_null=True)
