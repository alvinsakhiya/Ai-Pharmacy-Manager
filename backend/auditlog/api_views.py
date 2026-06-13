from django.db.models import Q
from rest_framework import pagination, viewsets

from .models import AuditEvent
from .serializers import AuditEventSerializer


class AuditEventPagination(pagination.PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditEventSerializer
    pagination_class = AuditEventPagination
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        queryset = AuditEvent.objects.select_related("actor").all()
        action = self.request.query_params.get("action", "").strip().upper()
        entity_type = self.request.query_params.get("entity_type", "").strip()
        search = self.request.query_params.get("search", "").strip()

        if action:
            queryset = queryset.filter(action=action)

        if entity_type:
            queryset = queryset.filter(entity_type__iexact=entity_type)

        if search:
            queryset = queryset.filter(
                Q(actor_username__icontains=search)
                | Q(entity_type__icontains=search)
                | Q(entity_identifier__icontains=search)
                | Q(summary__icontains=search)
                | Q(request_path__icontains=search)
            )

        return queryset
