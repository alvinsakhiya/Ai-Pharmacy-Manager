from django.db import transaction
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import SAFE_METHODS

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.tenancy.permissions import Action, require

from .models import Medication
from .selectors import medications_for
from .serializers import MedicationSerializer


def _audit_metadata(obj: Medication) -> dict[str, object]:
    return {
        "group_id": obj.group_id,
        "name": obj.name,
        "form": obj.form,
        "strength": obj.strength,
    }


class MedicationListCreateView(ListCreateAPIView):
    serializer_class = MedicationSerializer

    def get_permissions(self):
        action = (
            Action.MEDICATION_VIEW
            if self.request.method in SAFE_METHODS
            else Action.MEDICATION_MANAGE
        )
        return [require(action)()]

    def get_queryset(self):
        return (
            medications_for(self.request.user)
            .select_related("group")
            .order_by(
                "name",
                "strength",
            )
        )

    def perform_create(self, serializer):
        with transaction.atomic():
            obj = serializer.save()
            record(
                action=AuditAction.MEDICATION_CREATED,
                actor=self.request.user,
                group=obj.group,
                target=obj,
                request=self.request,
                metadata=_audit_metadata(obj),
            )


class MedicationDetailView(RetrieveUpdateAPIView):
    serializer_class = MedicationSerializer

    def get_permissions(self):
        action = (
            Action.MEDICATION_VIEW
            if self.request.method in SAFE_METHODS
            else Action.MEDICATION_MANAGE
        )
        return [require(action)()]

    def check_object_permissions(self, request, obj) -> None:
        return None

    def get_queryset(self):
        return medications_for(self.request.user).select_related("group")

    def perform_update(self, serializer):
        with transaction.atomic():
            obj = serializer.save()
            record(
                action=AuditAction.MEDICATION_UPDATED,
                actor=self.request.user,
                group=obj.group,
                target=obj,
                request=self.request,
                metadata=_audit_metadata(obj),
            )
