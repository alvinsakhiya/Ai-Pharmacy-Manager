import { requestJson } from "../../lib/apiClient";

export interface Medication {
  id: number;
  group: number;
  catalogue_product: number | null;
  catalogue_product_full_label: string | null;
  catalogue_product_pack_size: number | null;
  catalogue_product_pack_unit: string;
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
  group?: number;
  catalogue_product?: number | null;
  notes: string;
  is_active: boolean;
}

export interface CatalogueProduct {
  id: number;
  dmd_code: string;
  source: string;
  vmp_name: string;
  amp_name: string;
  display_name: string;
  ingredient: string;
  strength: string;
  dose_form: string;
  pack_size: number | null;
  pack_unit: string;
  manufacturer: string;
  appearance_colour: string;
  appearance_shape: string;
  appearance_form: string;
  full_label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export async function listCatalogueProducts(
  query: string,
): Promise<CatalogueProduct[]> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  return requestJson<CatalogueProduct[]>(
    `/api/catalogue/products/${params.size ? `?${params.toString()}` : ""}`,
  );
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
