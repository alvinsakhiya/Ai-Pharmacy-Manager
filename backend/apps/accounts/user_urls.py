from django.urls import path

from .user_views import (
    AssignMembershipView,
    UserDeactivateView,
    UserDetailView,
    UserListCreateView,
    UserResetPasswordView,
)

urlpatterns = [
    path("", UserListCreateView.as_view(), name="user-list-create"),
    path("<int:pk>/", UserDetailView.as_view(), name="user-detail"),
    path("<int:pk>/deactivate/", UserDeactivateView.as_view(), name="user-deactivate"),
    path(
        "<int:pk>/reset-password/",
        UserResetPasswordView.as_view(),
        name="user-reset-password",
    ),
    path(
        "<int:pk>/assign-membership/",
        AssignMembershipView.as_view(),
        name="user-assign-membership",
    ),
]
