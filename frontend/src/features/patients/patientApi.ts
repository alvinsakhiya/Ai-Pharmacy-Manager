import { requestJson } from "../../lib/apiClient";

export interface Patient {
  id: number;
  pharmacy: number;
  patient_reference: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  address: string;
  postcode: string;
  phone: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientNote {
  id: number;
  body: string;
  author: number | null;
  author_email: string;
  created_at: string;
}

export interface PatientListParams {
  pharmacy?: number;
  search?: string;
}

export function listPatients(params?: PatientListParams): Promise<Patient[]> {
  const searchParams = new URLSearchParams();
  if (params?.pharmacy !== undefined) {
    searchParams.set("pharmacy", String(params.pharmacy));
  }

  const search = params?.search?.trim();
  if (search) {
    searchParams.set("search", search);
  }

  const query = searchParams.toString();

  return requestJson<Patient[]>(`/api/patients/${query ? `?${query}` : ""}`);
}

export function getPatient(id: number): Promise<Patient> {
  return requestJson<Patient>(`/api/patients/${id}/`);
}
