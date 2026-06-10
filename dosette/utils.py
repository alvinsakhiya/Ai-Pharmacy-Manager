def calculate_weekly_quantity(record):
    total_daily_dose = 0

    for dose in [
        record.morning_dose,
        record.afternoon_dose,
        record.evening_dose,
        record.bedtime_dose,
    ]:
        if dose:
            try:
                total_daily_dose += float(dose)
            except ValueError:
                pass

    return int(total_daily_dose * 7)


def generate_patient_picking_list(patient):
    active_records = patient.dosette_records.filter(is_active=True)

    picking_list = []

    for record in active_records:
        weekly_quantity = calculate_weekly_quantity(record)

        picking_list.append({
            "patient": patient,
            "medication": record.medication,
            "morning_dose": record.morning_dose,
            "afternoon_dose": record.afternoon_dose,
            "evening_dose": record.evening_dose,
            "bedtime_dose": record.bedtime_dose,
            "weekly_quantity": weekly_quantity,
            "instructions": record.instructions,
        })

    return picking_list