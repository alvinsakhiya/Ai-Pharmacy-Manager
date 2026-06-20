import { requestJson } from "../../lib/apiClient";

export interface PatientMedicationLine {
  id: number;
  medication: number;
  medication_name: string;
  dose_instructions: string;
  strength?: string;
  form?: string;
  quantity_morning: number;
  quantity_lunchtime: number;
  quantity_evening: number;
  quantity_bedtime: number;
  start_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientMedicationWriteBody {
  medication: number;
  dose_instructions: string;
  quantity_morning: number;
  quantity_lunchtime: number;
  quantity_evening: number;
  quantity_bedtime: number;
  start_date: string | null;
}

export interface DosetteCycle {
  id: number;
  reference: string;
  frequency: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PickingListRow {
  medication_id: number;
  medication_name: string;
  strength: string;
  form: string;
  quantity_morning: number;
  quantity_lunchtime: number;
  quantity_evening: number;
  quantity_bedtime: number;
  total_daily: number;
}

export interface PickingListTotals {
  morning: number;
  lunchtime: number;
  evening: number;
  bedtime: number;
  total_daily: number;
}

export interface PickingList {
  cycle: {
    id: number;
    reference: string;
    frequency: string;
    start_date: string;
    end_date: string;
    status: string;
  };
  patient_reference: string;
  medications: PickingListRow[];
  totals: PickingListTotals;
}

export function listPatientMedications(
  patientId: number,
): Promise<PatientMedicationLine[]> {
  return requestJson<PatientMedicationLine[]>(
    `/api/patients/${patientId}/medications/`,
  );
}

export function listDosetteCycles(patientId: number): Promise<DosetteCycle[]> {
  return requestJson<DosetteCycle[]>(`/api/patients/${patientId}/cycles/`);
}

export function getPickingList(
  patientId: number,
  cycleId: number,
): Promise<PickingList> {
  return requestJson<PickingList>(
    `/api/patients/${patientId}/cycles/${cycleId}/picking-list/`,
  );
}

export function createPatientMedication(
  patientId: number,
  body: PatientMedicationWriteBody,
): Promise<PatientMedicationLine> {
  return requestJson<PatientMedicationLine>(
    `/api/patients/${patientId}/medications/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

export function updatePatientMedication(
  patientId: number,
  id: number,
  body: PatientMedicationWriteBody,
): Promise<PatientMedicationLine> {
  return requestJson<PatientMedicationLine>(
    `/api/patients/${patientId}/medications/${id}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

export function discontinuePatientMedication(
  patientId: number,
  id: number,
): Promise<PatientMedicationLine> {
  return requestJson<PatientMedicationLine>(
    `/api/patients/${patientId}/medications/${id}/discontinue/`,
    {
      method: "POST",
    },
  );
}
