import os

from django.core.asgi import get_asgi_application

# Server entrypoints fail safe: default to production settings so a WSGI/ASGI
# deployment that forgets to set DJANGO_SETTINGS_MODULE cannot silently boot
# with DEBUG and the dev-only keys. Local development uses manage.py (which
# defaults to dev) and docker-compose sets the variable explicitly.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

application = get_asgi_application()
