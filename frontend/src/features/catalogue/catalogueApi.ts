import { requestJson } from "../../lib/apiClient";

export interface Medication {
  id: number;
  group: number;
  name: string;
  form: string;
  strength: string;
  manufacturer: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationWriteBody {
  group: number;
  name: string;
  form: string;
  strength: string;
  manufacturer: string;
  notes: string;
  is_active: boolean;
}

export const FORM_OPTIONS = [
  { value: "TABLET", label: "Tablet" },
  { value: "CAPSULE", label: "Capsule" },
  { value: "LIQUID", label: "Liquid" },
  { value: "CREAM", label: "Cream" },
  { value: "INHALER", label: "Inhaler" },
  { value: "INJECTION", label: "Injection" },
  { value: "OTHER", label: "Other" },
] as const;

export function formLabel(value: string): string {
  return FORM_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export async function listMedications(): Promise<Medication[]> {
  return requestJson<Medication[]>("/api/catalogue/medications/");
}

export async function createMedication(
  body: MedicationWriteBody,
): Promise<Medication> {
  return requestJson<Medication>("/api/catalogue/medications/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function updateMedication(
  id: number,
  body: MedicationWriteBody,
): Promise<Medication> {
  return requestJson<Medication>(`/api/catalogue/medications/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
