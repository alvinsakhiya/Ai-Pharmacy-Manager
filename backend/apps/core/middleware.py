"""Thread-local capture of the current request user for audit logging."""
import threading

_state = threading.local()


def get_current_user():
    return getattr(_state, "user", None)


class CurrentUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _state.user = getattr(request, "user", None)
        try:
            response = self.get_response(request)
        finally:
            _state.user = None
        return response
