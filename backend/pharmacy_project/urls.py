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
from django.urls import path
from .api_views import dashboard_stats
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from patients.api_views import PatientViewSet
from inventory.api_views import MedicationViewSet, StockBatchViewSet
from dosette.api_views import DosetteRecordViewSet
from dosette.picking_api_views import patient_picking_list

router = DefaultRouter()
router.register(r"patients", PatientViewSet, basename="patients")
router.register(r"medications", MedicationViewSet, basename="medications")
router.register(r"stock-batches", StockBatchViewSet, basename="stock-batches")
router.register(r"dosette-records", DosetteRecordViewSet, basename="dosette-records")

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/dashboard/", dashboard_stats, name="dashboard_stats"),
    path("api/", include(router.urls)),
    path("api/picking-list/<int:patient_id>/", patient_picking_list, name="patient_picking_list"),
]
