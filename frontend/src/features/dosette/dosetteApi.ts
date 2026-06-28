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
  colour: string;
  shape: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientMedicationWriteBody {
  medication?: number;
  catalogue_product?: number;
  dose_instructions: string;
  quantity_morning: number;
  quantity_lunchtime: number;
  quantity_evening: number;
  quantity_bedtime: number;
  start_date: string | null;
  colour?: string;
  shape?: string;
}

export interface MedicationAppearanceBody {
  colour?: string;
  shape?: string;
}

/** Cycle lifecycle statuses the status endpoint accepts. */
export type CycleStatusTransition =
  | "CHECKED"
  | "COLLECTED"
  | "DELIVERED"
  | "NEEDS_CHANGES";

export interface DosetteCycle {
  id: number;
  reference: string;
  patient_reference: string;
  display_label: string;
  supply_period_label: string;
  frequency: string;
  start_date: string;
  end_date: string;
  due_status: string;
  days_until_due: number;
  is_due_soon: boolean;
  status: string;
  stock_deducted: boolean;
  deducted_at: string | null;
  prepared_by_email: string | null;
  prepared_at: string | null;
  checked_by_email: string | null;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DosettePeriodCycle {
  id: number;
  reference: string;
  week_number: number | null;
  start_date: string;
  end_date: string;
  status: string;
  stock_deducted: boolean;
}

export interface DosettePeriod {
  id: number;
  patient_reference: string;
  start_date: string;
  end_date: string;
  status: string;
  submitted_at: string;
  collected_on: string | null;
  next_due_date: string | null;
  reminder_date: string | null;
  cycles: DosettePeriodCycle[];
  created_at: string;
  updated_at: string;
}

export interface DosettePeriodSubmitBody {
  start_date?: string;
}

export interface DosettePeriodCollectedBody {
  collected_on?: string;
}

export const CYCLE_FREQUENCY_OPTIONS = [
  { value: "WEEKLY", label: "1-week supply" },
  { value: "FORTNIGHTLY", label: "2-week supply" },
  { value: "FOUR_WEEKLY", label: "4-week supply" },
  { value: "MONTHLY", label: "Monthly supply" },
] as const;

export interface DosetteCycleWriteBody {
  reference: string;
  frequency: string;
  start_date: string;
  end_date: string;
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
  colour: string;
  shape: string;
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

export interface StockPreviewBatch {
  batch_id: number;
  batch_number: string;
  expiry_date: string;
  quantity_available: number;
  quantity_to_pick: number;
}

export interface StockPreviewRow {
  medication_id: number;
  medication_name: string;
  strength: string;
  form: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  in_stock: boolean;
  earliest_expiry: string | null;
  suggested_batches: StockPreviewBatch[];
}

export interface StockPreviewTotals {
  required: number;
  available: number;
  shortage: number;
}

export interface StockPreview {
  cycle: {
    id: number;
    reference: string;
    frequency: string;
    start_date: string;
    end_date: string;
    status: string;
  };
  patient_reference: string;
  pharmacy_id: number;
  medications: StockPreviewRow[];
  totals: StockPreviewTotals;
}

export interface DeductStockMovement {
  movement_id: number;
  batch_id: number;
  batch_number: string;
  expiry_date: string;
  quantity_deducted: number;
  balance_after: number;
}

export interface DeductStockLine {
  medication_id: number;
  medication_name: string;
  required_quantity: number;
  movements: DeductStockMovement[];
}

export interface DeductStockResult {
  cycle: {
    id: number;
    reference: string;
    status: string;
    stock_deducted: boolean;
    deducted_at: string | null;
  };
  cycle_days: number;
  patient_reference: string;
  deductions: DeductStockLine[];
  totals: {
    required: number;
    deducted: number;
  };
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

export function listDosettePeriods(patientId: number): Promise<DosettePeriod[]> {
  return requestJson<DosettePeriod[]>(
    `/api/patients/${patientId}/dosette-periods/`,
  );
}

export function submitDosettePeriod(
  patientId: number,
  body: DosettePeriodSubmitBody = {},
): Promise<DosettePeriod> {
  return requestJson<DosettePeriod>(
    `/api/patients/${patientId}/dosette-periods/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export function markDosettePeriodCollected(
  patientId: number,
  periodId: number,
  body: DosettePeriodCollectedBody = {},
): Promise<DosettePeriod> {
  return requestJson<DosettePeriod>(
    `/api/patients/${patientId}/dosette-periods/${periodId}/collected/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export function getPickingList(
  patientId: number,
  cycleId: number,
): Promise<PickingList> {
  return requestJson<PickingList>(
    `/api/patients/${patientId}/cycles/${cycleId}/picking-list/`,
  );
}

export function getStockPreview(
  patientId: number,
  cycleId: number,
): Promise<StockPreview> {
  return requestJson<StockPreview>(
    `/api/patients/${patientId}/cycles/${cycleId}/stock-preview/`,
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

export function createDosetteCycle(
  patientId: number,
  body: DosetteCycleWriteBody,
): Promise<DosetteCycle> {
  return requestJson<DosetteCycle>(`/api/patients/${patientId}/cycles/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function updateDosetteCycle(
  patientId: number,
  id: number,
  body: DosetteCycleWriteBody,
): Promise<DosetteCycle> {
  return requestJson<DosetteCycle>(`/api/patients/${patientId}/cycles/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function prepareDosetteCycle(
  patientId: number,
  id: number,
): Promise<DosetteCycle> {
  return requestJson<DosetteCycle>(
    `/api/patients/${patientId}/cycles/${id}/prepare/`,
    {
      method: "POST",
    },
  );
}

export function updateCycleStatus(
  patientId: number,
  id: number,
  status: CycleStatusTransition,
): Promise<DosetteCycle> {
  return requestJson<DosetteCycle>(
    `/api/patients/${patientId}/cycles/${id}/status/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
}

export function updateMedicationAppearance(
  patientId: number,
  id: number,
  body: MedicationAppearanceBody,
): Promise<PatientMedicationLine> {
  return requestJson<PatientMedicationLine>(
    `/api/patients/${patientId}/medications/${id}/appearance/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export function cancelDosetteCycle(
  patientId: number,
  id: number,
): Promise<DosetteCycle> {
  return requestJson<DosetteCycle>(
    `/api/patients/${patientId}/cycles/${id}/cancel/`,
    {
      method: "POST",
    },
  );
}

export function deductDosetteStock(
  patientId: number,
  cycleId: number,
): Promise<DeductStockResult> {
  return requestJson<DeductStockResult>(
    `/api/patients/${patientId}/cycles/${cycleId}/deduct-stock/`,
    {
      method: "POST",
    },
  );
}
