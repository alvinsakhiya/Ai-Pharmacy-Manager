from django.urls import path

from .views import (
    ReviewCancelView,
    ReviewCompleteView,
    ReviewDetailView,
    ReviewListCreateView,
)

urlpatterns = [
    path("", ReviewListCreateView.as_view(), name="reviews-list-create"),
    path("<int:pk>/", ReviewDetailView.as_view(), name="reviews-detail"),
    path("<int:pk>/complete/", ReviewCompleteView.as_view(), name="reviews-complete"),
    path("<int:pk>/cancel/", ReviewCancelView.as_view(), name="reviews-cancel"),
]
