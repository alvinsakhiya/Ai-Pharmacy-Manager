from .models import DosetteMedicationChange


def _authenticated_actor(request):
    actor = getattr(request, "user", None)
    if actor is not None and getattr(actor, "is_authenticated", False):
        return actor
    return None


def determine_change_type(instance, changed_fields):
    changed_fields = set(changed_fields)

    if changed_fields == {"is_active"}:
        return (
            DosetteMedicationChange.ChangeType.ACTIVATED
            if instance.is_active
            else DosetteMedicationChange.ChangeType.DEACTIVATED
        )

    return DosetteMedicationChange.ChangeType.UPDATED


def record_dosette_change(
    instance,
    *,
    change_type,
    changed_fields,
    request,
):
    actor = _authenticated_actor(request)

    return DosetteMedicationChange.objects.create(
        dosette_record_identifier=instance.pk,
        patient_identifier=instance.patient_id,
        patient_name=str(instance.patient),
        medication_identifier=instance.medication_id,
        medication_name=str(instance.medication),
        change_type=change_type,
        changed_fields=sorted(set(changed_fields)),
        morning_dose=instance.morning_dose,
        afternoon_dose=instance.afternoon_dose,
        evening_dose=instance.evening_dose,
        bedtime_dose=instance.bedtime_dose,
        is_active=instance.is_active,
        cycle_start_date=instance.cycle_start_date,
        cycle_length_weeks=instance.cycle_length_weeks,
        review_date=instance.review_date,
        actor=actor,
        actor_username=actor.get_username() if actor else "",
    )
