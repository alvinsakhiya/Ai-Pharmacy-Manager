FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml ./
COPY config ./config
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

COPY . .

# Run as a non-root user. The media tree must stay writable: encrypted backup
# archives are written under media/backups at runtime.
RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p media/backups \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Fail-safe default: the production WSGI server. Local development overrides
# this with `runserver` in docker-compose.yml.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
