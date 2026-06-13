"""
URL configuration for pharmacy_project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.permissions import AllowAny
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    AuditedTokenObtainPairView,
    current_user_view,
    logout_view,
)
from auditlog.api_views import AuditEventViewSet
from patients.api_views import ClinicalReviewNoteViewSet, PatientViewSet
from inventory.api_views import (
    DraftPurchaseOrderViewSet,
    MedicationViewSet,
    StockBatchViewSet,
    StockMovementViewSet,
    SupplierViewSet,
)
from dosette.api_views import (
    DosetteMedicationChangeViewSet,
    DosetteRecordViewSet,
)
from dosette.picking_api_views import patient_picking_list
from notifications.api_views import NotificationViewSet
from operations.api_views import (
    FridgeTemperatureLogViewSet,
    LocalDeliveryViewSet,
    OpeningHourViewSet,
    OperationalTaskViewSet,
)
from .api_views import (
    dashboard_stats,
    expiry_alerts,
    medication_forecasts,
    stock_intelligence,
)
from .report_views import (
    audit_report_csv,
    expiry_report_csv,
    forecast_report_csv,
    notification_report_csv,
    picking_list_report_csv,
    stock_report_csv,
)

router = DefaultRouter()
router.register(r"patients", PatientViewSet, basename="patients")
router.register(
    r"clinical-reviews",
    ClinicalReviewNoteViewSet,
    basename="clinical-reviews",
)
router.register(r"medications", MedicationViewSet, basename="medications")
router.register(r"stock-batches", StockBatchViewSet, basename="stock-batches")
router.register(
    r"stock-movements",
    StockMovementViewSet,
    basename="stock-movements",
)
router.register(r"suppliers", SupplierViewSet, basename="suppliers")
router.register(
    r"draft-purchase-orders",
    DraftPurchaseOrderViewSet,
    basename="draft-purchase-orders",
)
router.register(r"dosette-records", DosetteRecordViewSet, basename="dosette-records")
router.register(
    r"dosette-changes",
    DosetteMedicationChangeViewSet,
    basename="dosette-changes",
)
router.register(r"audit-events", AuditEventViewSet, basename="audit-events")
router.register(r"notifications", NotificationViewSet, basename="notifications")
router.register(
    r"operational-tasks",
    OperationalTaskViewSet,
    basename="operational-tasks",
)
router.register(
    r"opening-hours",
    OpeningHourViewSet,
    basename="opening-hours",
)
router.register(
    r"local-deliveries",
    LocalDeliveryViewSet,
    basename="local-deliveries",
)
router.register(
    r"fridge-temperature-logs",
    FridgeTemperatureLogViewSet,
    basename="fridge-temperature-logs",
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/dashboard/", dashboard_stats, name="dashboard_stats"),
    path(
        "api/stock-intelligence/",
        stock_intelligence,
        name="stock_intelligence",
    ),
    path("api/", include(router.urls)),
    path("api/picking-list/<int:patient_id>/", patient_picking_list, name="patient_picking_list"),
    path("api/expiry-alerts/", expiry_alerts, name="expiry_alerts"),
    path(
        "api/auth/login/",
        AuditedTokenObtainPairView.as_view(permission_classes=[AllowAny]),
        name="token_obtain_pair",
    ),
    path(
        "api/auth/refresh/",
        TokenRefreshView.as_view(permission_classes=[AllowAny]),
        name="token_refresh",
    ),
    path("api/auth/me/", current_user_view, name="current_user"),
    path("api/auth/logout/", logout_view, name="logout"),
    path("api/forecasts/", medication_forecasts, name="medication_forecasts"),
    path(
        "api/reports/picking-list/<int:patient_id>.csv",
        picking_list_report_csv,
        name="report_picking_list_csv",
    ),
    path("api/reports/stock.csv", stock_report_csv, name="report_stock_csv"),
    path("api/reports/expiry.csv", expiry_report_csv, name="report_expiry_csv"),
    path(
        "api/reports/forecast.csv",
        forecast_report_csv,
        name="report_forecast_csv",
    ),
    path("api/reports/audit.csv", audit_report_csv, name="report_audit_csv"),
    path(
        "api/reports/notifications.csv",
        notification_report_csv,
        name="report_notification_csv",
    ),
]
