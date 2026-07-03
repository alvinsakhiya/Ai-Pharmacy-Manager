"""Contract tests for the health endpoint used by the container healthcheck.

The endpoint is intentionally unauthenticated and must stay a static, minimal
body: no version numbers, configuration, or database details may leak from it.
"""

import json

from django.test import Client


def test_health_returns_only_static_ok_body():
    response = Client().get("/api/health/")

    assert response.status_code == 200
    assert json.loads(response.content) == {"status": "ok"}


def test_health_requires_no_authentication_and_sets_no_session():
    response = Client().get("/api/health/")

    assert response.status_code == 200
    # No session or CSRF material should be minted for anonymous health probes.
    assert "Set-Cookie" not in response.headers
