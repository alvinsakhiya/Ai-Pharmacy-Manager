from django.urls import path

from .views import AlertClearView, AlertDismissView, AlertsView, WorkQueueView

urlpatterns = [
    path("alerts/", AlertsView.as_view(), name="notifications-alerts"),
    path("work-queue/", WorkQueueView.as_view(), name="notifications-work-queue"),
    path(
        "alerts/dismiss/",
        AlertDismissView.as_view(),
        name="notifications-alert-dismiss",
    ),
    path("alerts/clear/", AlertClearView.as_view(), name="notifications-alert-clear"),
]
