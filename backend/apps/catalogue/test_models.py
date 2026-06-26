import pytest
from django.db import IntegrityError

from apps.tenancy.models import Group

from .models import CatalogueProduct, Medication, MedicationForm
from .services import get_or_create_medication_from_product


@pytest.fixture
def amlodipine_product():
    return CatalogueProduct.objects.create(
        dmd_code="SEED-AMLO-5",
        source="SEED",
        display_name="Amlodipine 5mg tablets",
        ingredient="Amlodipine",
        strength="5mg",
        dose_form="tablets",
        pack_size=28,
    )


@pytest.mark.django_db
def test_catalogue_product_full_label_with_pack_size():
    product = CatalogueProduct.objects.create(
        display_name="Paracetamol 500mg tablets",
        ingredient="Paracetamol",
        strength="500mg",
        dose_form="tablets",
        pack_size=100,
    )

    assert product.full_label == "Paracetamol 500mg tablets — pack of 100"


@pytest.mark.django_db
def test_catalogue_product_full_label_with_pack_unit():
    product = CatalogueProduct.objects.create(
        display_name="Lactulose 3.1g/5ml solution",
        ingredient="Lactulose",
        strength="3.1g/5ml",
        dose_form="solution",
        pack_size=500,
        pack_unit="ml",
    )

    assert product.full_label == "Lactulose 3.1g/5ml solution — pack of 500 ml"


@pytest.mark.django_db
def test_catalogue_product_search_text_is_populated():
    product = CatalogueProduct.objects.create(
        display_name="Ibuprofen 400mg tablets",
        ingredient="Ibuprofen",
        strength="400mg",
        dose_form="tablets",
        pack_size=48,
        manufacturer="Generic",
    )

    assert "ibuprofen" in product.search_text
    assert "400mg" in product.search_text
    assert "48" in product.search_text


@pytest.mark.django_db
def test_medication_can_be_created():
    group = Group.objects.create(name="Group One", slug="catalogue-group-one")

    medication = Medication.objects.create(
        group=group,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
        manufacturer="Generic",
        notes="Demo catalogue item",
    )

    assert medication.group == group
    assert medication.name == "Paracetamol"
    assert medication.form == MedicationForm.TABLET
    assert medication.strength == "500 mg"
    assert medication.is_active is True


@pytest.mark.django_db
def test_medication_unique_tuple_is_enforced_within_group():
    group = Group.objects.create(name="Group One", slug="catalogue-unique-one")
    Medication.objects.create(
        group=group,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
    )

    with pytest.raises(IntegrityError):
        Medication.objects.create(
            group=group,
            name="Paracetamol",
            form=MedicationForm.TABLET,
            strength="500 mg",
        )


@pytest.mark.django_db
def test_same_medication_tuple_can_exist_in_different_groups():
    group_one = Group.objects.create(name="Group One", slug="catalogue-same-one")
    group_two = Group.objects.create(name="Group Two", slug="catalogue-same-two")

    first = Medication.objects.create(
        group=group_one,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
    )
    second = Medication.objects.create(
        group=group_two,
        name="Paracetamol",
        form=MedicationForm.TABLET,
        strength="500 mg",
    )

    assert first.pk != second.pk


@pytest.mark.django_db
def test_get_or_create_medication_from_product_is_idempotent_per_group_product(
    amlodipine_product,
):
    group = Group.objects.create(name="Group One", slug="catalogue-product-one")

    first = get_or_create_medication_from_product(group, amlodipine_product)
    second = get_or_create_medication_from_product(group, amlodipine_product)

    assert first.pk == second.pk
    assert first.name == "Amlodipine 5mg tablets"
    assert first.form == MedicationForm.TABLET
    assert first.strength == "5mg"
    assert first.catalogue_product == amlodipine_product


@pytest.mark.django_db
def test_get_or_create_medication_from_product_reuses_pack_variant_tuple():
    group = Group.objects.create(name="Group One", slug="catalogue-pack-variant")
    first_pack = CatalogueProduct.objects.create(
        display_name="Ibuprofen 400mg tablets",
        ingredient="Ibuprofen",
        strength="400mg",
        dose_form="tablets",
        pack_size=48,
    )
    second_pack = CatalogueProduct.objects.create(
        display_name="Ibuprofen 400mg tablets",
        ingredient="Ibuprofen",
        strength="400mg",
        dose_form="tablets",
        pack_size=48,
        pack_unit="tablets",
    )

    first = get_or_create_medication_from_product(group, first_pack)
    second = get_or_create_medication_from_product(group, second_pack)

    assert second == first
    assert first.catalogue_product == first_pack
    assert (
        Medication.objects.filter(
            group=group,
            name="Ibuprofen 400mg tablets",
            form=MedicationForm.TABLET,
            strength="400mg",
        ).count()
        == 1
    )
