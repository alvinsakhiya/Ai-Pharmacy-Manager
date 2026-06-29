from django.urls import path

from .views import (
    BackupDeleteView,
    BackupRestoreView,
    BackupRunListView,
    BackupRunNowView,
    BackupScheduleView,
)

urlpatterns = [
    path("schedule/", BackupScheduleView.as_view(), name="backup-schedule"),
    path("runs/", BackupRunListView.as_view(), name="backup-run-list"),
    path("runs/now/", BackupRunNowView.as_view(), name="backup-run-now"),
    path("runs/<int:pk>/restore/", BackupRestoreView.as_view(), name="backup-restore"),
    path("runs/<int:pk>/", BackupDeleteView.as_view(), name="backup-delete"),
]
