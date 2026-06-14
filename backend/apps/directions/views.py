from django.db.models import Case, IntegerField, Q, Value, When
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import TrustedDirection
from .serializers import TrustedDirectionSerializer


class TrustedDirectionViewSet(viewsets.ReadOnlyModelViewSet):
    """Search approved label phrases by shortcut code or visible wording."""

    permission_classes = [IsAuthenticated]
    serializer_class = TrustedDirectionSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = TrustedDirection.objects.filter(is_active=True)
        query = (self.request.query_params.get("q") or "").strip()
        category = (self.request.query_params.get("category") or "").strip()
        if category:
            queryset = queryset.filter(category=category)
        if not query:
            return queryset[:100]

        return (
            queryset.filter(Q(code__icontains=query) | Q(text__icontains=query))
            .annotate(
                match_rank=Case(
                    When(code__iexact=query, then=Value(0)),
                    When(code__istartswith=query, then=Value(1)),
                    When(text__istartswith=query, then=Value(2)),
                    default=Value(3),
                    output_field=IntegerField(),
                )
            )
            .order_by("match_rank", "sort_order", "code")[:100]
        )
