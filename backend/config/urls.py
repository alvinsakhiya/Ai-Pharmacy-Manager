from django.http import JsonResponse
from django.urls import include, path


def health_check(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", health_check, name="root"),
    path("api/health/", health_check, name="health"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/audit/", include("apps.audit.urls")),
    path("api/catalogue/", include("apps.catalogue.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path(
        "api/patients/<int:patient_pk>/medications/",
        include("apps.blister.urls"),
    ),
    path(
        "api/patients/<int:patient_pk>/cycles/",
        include("apps.blister.cycle_urls"),
    ),
    path("api/patients/", include("apps.patients.urls")),
    path("api/users/", include("apps.accounts.user_urls")),
    path("api/tenancy/", include("apps.tenancy.urls")),
]
