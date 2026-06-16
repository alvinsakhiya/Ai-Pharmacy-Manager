from django.db import transaction
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView

from apps.audit.models import AuditAction
from apps.audit.services import record

from .models import Group, Pharmacy
from .permissions import Action, require
from .serializers import GroupSerializer, PharmacySerializer


class GroupListCreateView(ListCreateAPIView):
    queryset = Group.objects.all().order_by("id")
    serializer_class = GroupSerializer
    permission_classes = [require(Action.GROUP_MANAGE)]

    def perform_create(self, serializer):
        with transaction.atomic():
            obj = serializer.save()
            record(
                action=AuditAction.GROUP_CREATED,
                actor=self.request.user,
                target=obj,
                request=self.request,
                metadata={
                    "name": obj.name,
                    "slug": obj.slug,
                },
            )


class GroupDetailView(RetrieveUpdateAPIView):
    queryset = Group.objects.all().order_by("id")
    serializer_class = GroupSerializer
    permission_classes = [require(Action.GROUP_MANAGE)]

    def perform_update(self, serializer):
        with transaction.atomic():
            obj = serializer.save()
            record(
                action=AuditAction.GROUP_UPDATED,
                actor=self.request.user,
                target=obj,
                request=self.request,
                metadata={
                    "name": obj.name,
                    "slug": obj.slug,
                    "is_active": obj.is_active,
                },
            )


class PharmacyListCreateView(ListCreateAPIView):
    queryset = Pharmacy.objects.select_related("group").all().order_by("id")
    serializer_class = PharmacySerializer
    permission_classes = [require(Action.PHARMACY_MANAGE)]

    def perform_create(self, serializer):
        with transaction.atomic():
            obj = serializer.save()
            record(
                action=AuditAction.PHARMACY_CREATED,
                actor=self.request.user,
                target=obj,
                request=self.request,
                metadata={
                    "group_id": obj.group_id,
                    "name": obj.name,
                    "code": obj.code,
                },
            )


class PharmacyDetailView(RetrieveUpdateAPIView):
    queryset = Pharmacy.objects.select_related("group").all().order_by("id")
    serializer_class = PharmacySerializer
    permission_classes = [require(Action.PHARMACY_MANAGE)]

    def perform_update(self, serializer):
        with transaction.atomic():
            obj = serializer.save()
            record(
                action=AuditAction.PHARMACY_UPDATED,
                actor=self.request.user,
                target=obj,
                request=self.request,
                metadata={
                    "group_id": obj.group_id,
                    "name": obj.name,
                    "code": obj.code,
                    "is_active": obj.is_active,
                },
            )
