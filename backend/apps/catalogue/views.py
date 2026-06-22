from django.db import transaction
from django.db.models import Q
from rest_framework.generics import (
    ListAPIView,
    ListCreateAPIView,
    RetrieveAPIView,
    RetrieveUpdateAPIView,
)
from rest_framework.permissions import SAFE_METHODS

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.tenancy.permissions import Action, require

from .models import CatalogueProduct, Medication
from .selectors import medications_for
from .serializers import CatalogueProductSerializer, MedicationSerializer


class CatalogueProductListView(ListAPIView):
    serializer_class = CatalogueProductSerializer

    def get_permissions(self):
        return [require(Action.MEDICATION_VIEW)()]

    def get_queryset(self):
        queryset = CatalogueProduct.objects.filter(is_active=True).order_by(
            "display_name",
            "pack_size",
        )
        query = self.request.query_params.get("q", "").strip()
        if not query:
            return queryset[:50]

        for term in query.split():
            queryset = queryset.filter(
                Q(display_name__icontains=term)
                | Q(ingredient__icontains=term)
                | Q(strength__icontains=term)
                | Q(dose_form__icontains=term)
                | Q(manufacturer__icontains=term)
                | Q(search_text__icontains=term)
            )
        return queryset[:50]


class CatalogueProductDetailView(RetrieveAPIView):
    serializer_class = CatalogueProductSerializer
    http_method_names = ["get", "head", "options"]

    def get_permissions(self):
        return [require(Action.MEDICATION_VIEW)()]

    def get_queryset(self):
        return CatalogueProduct.objects.filter(is_active=True)


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
            .select_related("group", "catalogue_product")
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
        return medications_for(self.request.user).select_related(
            "group",
            "catalogue_product",
        )

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
