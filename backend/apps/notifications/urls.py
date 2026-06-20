from django.urls import path

from .views import AlertsView

urlpatterns = [
    path("alerts/", AlertsView.as_view(), name="notifications-alerts"),
]
