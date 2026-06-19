import pytest
from django.db import IntegrityError

from apps.tenancy.models import Group

from .models import Medication, MedicationForm


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
