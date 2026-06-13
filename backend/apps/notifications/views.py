from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsPharmacistOrAdmin, RolePermission

from .models import Notification
from .serializers import NotificationSerializer
from .services import generate_notifications


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [RolePermission]
    filterset_fields = ["level", "category", "is_read"]

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        return Response({"count": Notification.objects.filter(is_read=False).count()})

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        n = self.get_object()
        n.is_read = True
        n.save(update_fields=["is_read", "updated_at"])
        return Response(self.get_serializer(n).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        Notification.objects.filter(is_read=False).update(is_read=True)
        return Response({"status": "ok"})

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[IsPharmacistOrAdmin],
    )
    def refresh(self, request):
        """Re-scan operational state and (re)generate alerts."""
        count = generate_notifications()
        return Response({"generated": count})
