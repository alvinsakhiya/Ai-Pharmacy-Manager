import pytest
from django.core.management import call_command

from .management.commands.seed_catalogue import SEED_PRODUCTS
from .models import CatalogueProduct, CatalogueProductSource


@pytest.mark.django_db
def test_seed_catalogue_is_idempotent():
    call_command("seed_catalogue")
    first_count = CatalogueProduct.objects.count()

    call_command("seed_catalogue")
    second_count = CatalogueProduct.objects.count()

    assert first_count == len(SEED_PRODUCTS)
    assert second_count == first_count
    assert CatalogueProduct.objects.filter(
        source=CatalogueProductSource.SEED,
        display_name="Amlodipine 5mg tablets",
        pack_size=28,
    ).exists()
