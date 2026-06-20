"""Prototype operational pharmacist review API views.

These views expose an operational review workflow only. They do not perform
clinical decision-making, diagnosis, automated recommendations, NHS
integration, or make any compliance claim.
"""

from typing import Any

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.services import record
from apps.tenancy.permissions import Action, require

from .models import ReviewPriority, ReviewRecord, ReviewStatus
from .serializers import ReviewRecordSerializer
from .services import cancel_review, complete_review, update_review


def _audit_metadata(review: ReviewRecord) -> dict[str, object]:
    return {
        "pharmacy_id": review.patient.pharmacy_id,
        "patient_id": review.patient_id,
        "patient_reference": review.patient.patient_reference,
        "review_id": review.id,
        "status": review.status,
        "priority": review.priority,
        "dosette_cycle_id": review.dosette_cycle_id,
        "assigned_to_id": review.assigned_to_id,
    }


def _filtered_reviews(queryset, request):
    status_filter = request.query_params.get("status")
    if status_filter in ReviewStatus.values:
        queryset = queryset.filter(status=status_filter)

    priority_filter = request.query_params.get("priority")
    if priority_filter in ReviewPriority.values:
        queryset = queryset.filter(priority=priority_filter)

    patient_id = request.query_params.get("patient")
    if patient_id is not None:
        try:
            queryset = queryset.filter(patient_id=int(patient_id))
        except ValueError:
            return queryset.none()

    assigned = request.query_params.get("assigned")
    if assigned is not None:
        try:
            queryset = queryset.filter(assigned_to_id=int(assigned))
        except ValueError:
            return queryset.none()

    if request.query_params.get("overdue") in {"true", "1", "yes"}:
        queryset = queryset.filter(
            due_date__lt=timezone.now().date(),
        ).exclude(status__in=[ReviewStatus.COMPLETED, ReviewStatus.CANCELLED])

    return queryset


class ReviewMixin:
    serializer_class = ReviewRecordSerializer
    request: Any

    def get_permissions(self):
        action = (
            Action.REVIEW_VIEW
            if self.request.method in SAFE_METHODS
            else Action.REVIEW_MANAGE
        )
        return [require(action)()]

    def check_object_permissions(self, request, obj) -> None:
        return None

    def get_queryset(self):
        return ReviewRecord.scoped.for_user(self.request.user).select_related(
            "patient",
            "patient__pharmacy",
            "dosette_cycle",
            "assigned_to",
        )


class ReviewListCreateView(ReviewMixin, ListCreateAPIView):
    def get_queryset(self):
        return _filtered_reviews(super().get_queryset(), self.request)

    def perform_create(self, serializer):
        with transaction.atomic():
            review = serializer.save(
                status=ReviewStatus.PENDING,
                completed_at=None,
            )
            record(
                action=AuditAction.REVIEW_CREATED,
                actor=self.request.user,
                pharmacy=review.patient.pharmacy,
                target=review,
                request=self.request,
                metadata=_audit_metadata(review),
            )


class ReviewDetailView(ReviewMixin, RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        changed_fields = sorted(serializer.validated_data.keys())

        with transaction.atomic():
            review = update_review(instance, serializer.validated_data, request.user)
            metadata = _audit_metadata(review)
            metadata["changed_fields"] = changed_fields
            record(
                action=AuditAction.REVIEW_UPDATED,
                actor=request.user,
                pharmacy=review.patient.pharmacy,
                target=review,
                request=request,
                metadata=metadata,
            )

        return Response(
            self.get_serializer(review).data,
            status=status.HTTP_200_OK,
        )


class ReviewTransitionMixin(APIView):
    permission_classes = [require(Action.REVIEW_MANAGE)]

    def get_review(self, request, pk):
        return get_object_or_404(
            ReviewRecord.scoped.for_user(request.user).select_related(
                "patient",
                "patient__pharmacy",
                "dosette_cycle",
                "assigned_to",
            ),
            pk=pk,
        )


class ReviewCompleteView(ReviewTransitionMixin):
    def post(self, request, pk):
        review = self.get_review(request, pk)

        with transaction.atomic():
            review = complete_review(review, request.user)
            record(
                action=AuditAction.REVIEW_COMPLETED,
                actor=request.user,
                pharmacy=review.patient.pharmacy,
                target=review,
                request=request,
                metadata=_audit_metadata(review),
            )

        return Response(
            ReviewRecordSerializer(review, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class ReviewCancelView(ReviewTransitionMixin):
    def post(self, request, pk):
        review = self.get_review(request, pk)

        with transaction.atomic():
            review = cancel_review(review, request.user)
            record(
                action=AuditAction.REVIEW_CANCELLED,
                actor=request.user,
                pharmacy=review.patient.pharmacy,
                target=review,
                request=request,
                metadata=_audit_metadata(review),
            )

        return Response(
            ReviewRecordSerializer(review, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
