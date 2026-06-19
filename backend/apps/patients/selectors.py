from .models import Patient


def patients_for(user):
    return Patient.scoped.for_user(user).select_related("pharmacy")
