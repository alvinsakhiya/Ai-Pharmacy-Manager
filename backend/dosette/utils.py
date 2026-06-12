from decimal import Decimal, InvalidOperation

from inventory.utils import allocate_stock_fefo


DOSE_FIELDS = (
    "morning_dose",
    "afternoon_dose",
    "evening_dose",
    "bedtime_dose",
)


class InvalidDoseValue(ValueError):
    """Raised when a dose cannot be used safely in demand calculations."""


def normalise_dose_value(value, field_name="dose"):
    label = field_name.replace("_", " ").capitalize()

    if value is None or (isinstance(value, str) and not value.strip()):
        return Decimal("0")

    try:
        dose = Decimal(str(value).strip())
    except (InvalidOperation, TypeError, ValueError):
        raise InvalidDoseValue(f"{label} must be a valid number.") from None

    if not dose.is_finite():
        raise InvalidDoseValue(f"{label} must be a finite number.")

    if dose < 0:
        raise InvalidDoseValue(f"{label} cannot be negative.")

    return dose


def calculate_weekly_quantity(record):
    total_daily_dose = Decimal("0")

    for field_name in DOSE_FIELDS:
        total_daily_dose += normalise_dose_value(
            getattr(record, field_name),
            field_name,
        )

    return int(total_daily_dose * Decimal("7"))


def generate_patient_picking_list(patient):
    active_records = patient.dosette_records.filter(is_active=True)

    picking_list = []

    for record in active_records:
        weekly_quantity = calculate_weekly_quantity(record)
        fefo_allocation = allocate_stock_fefo(record.medication, weekly_quantity)

        picking_list.append({
            "patient": patient,
            "medication": record.medication,
            "morning_dose": record.morning_dose,
            "afternoon_dose": record.afternoon_dose,
            "evening_dose": record.evening_dose,
            "bedtime_dose": record.bedtime_dose,
            "weekly_quantity": weekly_quantity,
            "instructions": record.instructions,
            "fefo_allocation": fefo_allocation,
        })

    return picking_list
