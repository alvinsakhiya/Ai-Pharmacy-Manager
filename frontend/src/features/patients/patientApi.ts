import { requestJson } from "../../lib/apiClient";

export interface PatientGp {
  doctor_name: string;
  practice_name: string;
  practice_address: string;
  practice_postcode: string;
  practice_phone: string;
  practice_email: string;
  updated_at?: string;
}

export type PatientGpWriteBody = Omit<PatientGp, "updated_at">;

export type PatientCollectionMethod = "IN_STORE" | "DELIVERY";

export const DEFAULT_COLLECTION_METHOD: PatientCollectionMethod = "IN_STORE";

export const COLLECTION_METHOD_LABELS: Record<PatientCollectionMethod, string> = {
  IN_STORE: "In-store collection",
  DELIVERY: "Delivery",
};

export function normaliseCollectionMethod(
  value: PatientCollectionMethod | null | undefined,
): PatientCollectionMethod {
  return value === "DELIVERY" ? "DELIVERY" : DEFAULT_COLLECTION_METHOD;
}

export function collectionMethodLabel(
  value: PatientCollectionMethod | null | undefined,
): string {
  return COLLECTION_METHOD_LABELS[normaliseCollectionMethod(value)];
}

export interface Patient {
  id: number;
  pharmacy: number;
  patient_reference: string;
  title?: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender?: string | null;
  address: string;
  postcode: string;
  phone: string;
  email?: string | null;
  notes: string;
  collection_method?: PatientCollectionMethod | null;
  gp?: PatientGp | null;
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

export interface PatientNoteWriteBody {
  body: string;
}

export interface PatientListParams {
  pharmacy?: number;
  search?: string;
}

export interface PatientWriteBody {
  pharmacy: number;
  title: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
  notes: string;
  collection_method: PatientCollectionMethod;
}

export type PatientUpdateBody = Omit<PatientWriteBody, "pharmacy">;

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

export function createPatient(body: PatientWriteBody): Promise<Patient> {
  return requestJson<Patient>("/api/patients/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function updatePatient(
  id: number,
  body: PatientUpdateBody,
): Promise<Patient> {
  return requestJson<Patient>(`/api/patients/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function deactivatePatient(id: number): Promise<Patient> {
  return requestJson<Patient>(`/api/patients/${id}/deactivate/`, {
    method: "POST",
  });
}

export function listPatientNotes(patientId: number): Promise<PatientNote[]> {
  return requestJson<PatientNote[]>(`/api/patients/${patientId}/notes/`);
}

export function createPatientNote(
  patientId: number,
  body: PatientNoteWriteBody,
): Promise<PatientNote> {
  return requestJson<PatientNote>(`/api/patients/${patientId}/notes/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function getPatientGp(patientId: number): Promise<PatientGp> {
  return requestJson<PatientGp>(`/api/patients/${patientId}/gp/`);
}

export function updatePatientGp(
  patientId: number,
  body: PatientGpWriteBody,
): Promise<PatientGp> {
  return requestJson<PatientGp>(`/api/patients/${patientId}/gp/`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
