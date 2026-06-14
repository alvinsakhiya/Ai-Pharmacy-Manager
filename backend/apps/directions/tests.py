import pytest

from apps.directions.models import TrustedDirection


@pytest.fixture
def directions(db):
    return [
        TrustedDirection.objects.create(
            code="ONE", text="Take one tablet", category="dose", sort_order=10
        ),
        TrustedDirection.objects.create(
            code="OD", text="Once daily", category="timing", sort_order=20
        ),
        TrustedDirection.objects.create(
            code="PRN", text="When required", category="qualifier", sort_order=30
        ),
        TrustedDirection.objects.create(
            code="OLD", text="Inactive phrase", is_active=False
        ),
    ]


@pytest.mark.django_db
def test_all_staff_can_search_trusted_directions(auth, directions):
    for role in ("dispenser", "pharmacist", "administrator"):
        response = auth(role).get("/api/trusted-directions/?q=one")
        assert response.status_code == 200
        assert response.data[0]["code"] == "ONE"
        assert response.data[0]["text"] == "Take one tablet"


@pytest.mark.django_db
def test_exact_code_is_ranked_before_text_match(auth, directions):
    TrustedDirection.objects.create(
        code="XOD", text="OD support phrase", category="general", sort_order=1
    )
    response = auth("dispenser").get("/api/trusted-directions/?q=OD")
    assert response.status_code == 200
    assert response.data[0]["code"] == "OD"


@pytest.mark.django_db
def test_inactive_directions_are_not_returned(auth, directions):
    response = auth("pharmacist").get("/api/trusted-directions/?q=inactive")
    assert response.status_code == 200
    assert response.data == []


@pytest.mark.django_db
def test_endpoint_is_read_only(auth, directions):
    response = auth("administrator").post(
        "/api/trusted-directions/",
        {"code": "NEW", "text": "New phrase", "category": "general"},
        format="json",
    )
    assert response.status_code == 405
