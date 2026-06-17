from rest_framework.generics import ListAPIView

from apps.tenancy.permissions import Action, require

from .models import AuditAction
from .pagination import AuditPagination
from .selectors import audit_events_for
from .serializers import AuditEventSerializer


class AuditEventListView(ListAPIView):
    serializer_class = AuditEventSerializer
    pagination_class = AuditPagination
    permission_classes = [require(Action.AUDIT_VIEW)]

    def get_queryset(self):
        queryset = audit_events_for(self.request.user).order_by("-created_at")

        action = self.request.query_params.get("action")
        if action is not None:
            try:
                queryset = queryset.filter(action=AuditAction(action))
            except ValueError:
                pass

        return queryset
