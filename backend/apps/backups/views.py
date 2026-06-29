from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenancy.models import Group, Role
from apps.tenancy.policy import get_active_membership

from .models import BackupRun
from .serializers import BackupRunSerializer, BackupScheduleSerializer
from .services import (
    BackupError,
    RestoreConfirmationError,
    create_backup,
    delete_backup,
    get_or_create_schedule,
    restore_backup,
)


def _active_role(request):
    membership = get_active_membership(request.user)
    if membership is None:
        raise PermissionDenied("Backup settings require an active account.")
    return membership


def _require_backup_operator(request):
    membership = _active_role(request)
    if membership.role not in {Role.ADMIN, Role.PHARMACIST}:
        raise PermissionDenied("Backup settings are restricted.")
    return membership


def _require_backup_admin(request):
    membership = _active_role(request)
    if membership.role != Role.ADMIN:
        raise PermissionDenied("Restore is restricted to admin users.")
    return membership


def _group_from_request(request):
    membership = _require_backup_operator(request)
    if membership.role == Role.PHARMACIST and membership.pharmacy_id is not None:
        return membership.pharmacy.group

    group_id = request.query_params.get("group") or request.data.get("group")
    if group_id:
        return get_object_or_404(Group.objects.all(), pk=group_id)

    groups = list(Group.objects.order_by("id")[:2])
    if len(groups) == 1:
        return groups[0]

    raise ValidationError({"group": "Select a group for backup settings."})


class BackupScheduleView(APIView):
    def get(self, request):
        group = _group_from_request(request)
        schedule = get_or_create_schedule(group, actor=request.user)
        return Response(BackupScheduleSerializer(schedule).data)

    def put(self, request):
        group = _group_from_request(request)
        schedule = get_or_create_schedule(group, actor=request.user)
        serializer = BackupScheduleSerializer(
            schedule,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(BackupScheduleSerializer(schedule).data)


class BackupRunListView(APIView):
    def get(self, request):
        group = _group_from_request(request)
        runs = BackupRun.objects.filter(group=group).order_by(
            "-completed_at",
            "-started_at",
            "-id",
        )[:3]
        return Response(BackupRunSerializer(runs, many=True).data)


class BackupRunNowView(APIView):
    def post(self, request):
        group = _group_from_request(request)
        run = create_backup(group=group, actor=request.user)
        return Response(BackupRunSerializer(run).data, status=status.HTTP_201_CREATED)


class BackupRestoreView(APIView):
    def post(self, request, pk):
        _require_backup_admin(request)
        run = get_object_or_404(BackupRun.objects.select_related("group"), pk=pk)
        try:
            restored = restore_backup(
                run=run,
                actor=request.user,
                confirm=request.data.get("confirm", ""),
            )
        except RestoreConfirmationError as exc:
            raise ValidationError({"confirm": str(exc)}) from exc
        except BackupError as exc:
            raise ValidationError({"backup": str(exc)}) from exc
        return Response(BackupRunSerializer(restored).data)


class BackupDeleteView(APIView):
    def delete(self, request, pk):
        _require_backup_admin(request)
        run = get_object_or_404(BackupRun.objects.all(), pk=pk)
        delete_backup(run)
        return Response(status=status.HTTP_204_NO_CONTENT)
