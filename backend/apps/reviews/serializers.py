from django.utils import timezone
from rest_framework import serializers

from apps.accounts.selectors import users_visible_to
from apps.blister.models import DosetteCycle
from apps.patients.selectors import patients_for

from .models import ReviewRecord, ReviewStatus


class ReviewRecordSerializer(serializers.ModelSerializer):
    patient_reference = serializers.CharField(
        source="patient.patient_reference",
        read_only=True,
    )
    cycle_reference = serializers.CharField(
        source="dosette_cycle.reference",
        read_only=True,
        allow_null=True,
    )
    assigned_to_email = serializers.EmailField(
        source="assigned_to.email",
        read_only=True,
        allow_null=True,
    )
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = ReviewRecord
        fields = [
            "id",
            "patient",
            "patient_reference",
            "dosette_cycle",
            "cycle_reference",
            "status",
            "priority",
            "assigned_to",
            "assigned_to_email",
            "due_date",
            "completed_at",
            "is_overdue",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "completed_at", "created_at", "updated_at"]
        validators: list[object] = []

    def get_is_overdue(self, obj: ReviewRecord) -> bool:
        return (
            obj.due_date is not None
            and obj.due_date < timezone.now().date()
            and obj.status not in {ReviewStatus.COMPLETED, ReviewStatus.CANCELLED}
        )

    def validate(self, attrs):
        request = self.context.get("request")
        if request is None:
            return attrs

        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        dosette_cycle = attrs.get(
            "dosette_cycle",
            getattr(self.instance, "dosette_cycle", None),
        )

        if self.instance is None and patient is None:
            raise serializers.ValidationError({"patient": ["This field is required."]})

        if (
            patient is not None
            and not patients_for(request.user).filter(pk=patient.pk).exists()
        ):
            raise serializers.ValidationError(
                {"patient": ["This patient is outside your review scope."]}
            )

        if dosette_cycle is not None:
            if (
                not DosetteCycle.scoped.for_user(request.user)
                .filter(pk=dosette_cycle.pk)
                .exists()
            ):
                raise serializers.ValidationError(
                    {"dosette_cycle": ["This cycle is outside your review scope."]}
                )
            if patient is not None and dosette_cycle.patient_id != patient.id:
                raise serializers.ValidationError(
                    {"dosette_cycle": ["Cycle must belong to the selected patient."]}
                )

        # A review may only be assigned to a user within the caller's scope; the
        # default writable FK queryset would otherwise accept any user id and echo
        # their email back via assigned_to_email (cross-tenant enumeration).
        assigned_to = attrs.get("assigned_to")
        if (
            assigned_to is not None
            and not users_visible_to(request.user).filter(pk=assigned_to.pk).exists()
        ):
            raise serializers.ValidationError(
                {"assigned_to": ["This user is outside your assignment scope."]}
            )

        return attrs
