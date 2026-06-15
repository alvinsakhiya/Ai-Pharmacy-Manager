from django.http import JsonResponse
from django.urls import path


def health_check(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", health_check, name="root"),
    path("api/health/", health_check, name="health"),
]
