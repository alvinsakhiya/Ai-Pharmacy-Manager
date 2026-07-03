import os

from django.core.wsgi import get_wsgi_application

# Server entrypoints fail safe: default to production settings so a WSGI/ASGI
# deployment (e.g. gunicorn) that forgets to set DJANGO_SETTINGS_MODULE cannot
# silently boot with DEBUG and the dev-only keys. Local development uses
# manage.py (which defaults to dev) and docker-compose sets the variable
# explicitly, so this does not affect the dev workflow.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

application = get_wsgi_application()
