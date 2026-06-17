import { apiFetch } from "../../lib/api";

export interface UserPharmacy {
  id: number;
  name: string;
}

export interface ManagedUser {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  must_change_password: boolean;
  role: string | null;
  pharmacy: UserPharmacy | null;
  date_joined: string;
}

export interface PharmacyOption {
  id: number;
  name: string;
}

export interface CreateUserBody {
  email: string;
  full_name: string;
  password: string;
  role: string;
  pharmacy_id?: number | null;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  const data = await parseJson(response);

  if (!response.ok) {
    throw new ApiError("Request failed.", response.status, data);
  }

  return data as T;
}

export async function listUsers(): Promise<ManagedUser[]> {
  return requestJson<ManagedUser[]>("/api/users/");
}

export async function createUser(body: CreateUserBody): Promise<ManagedUser> {
  return requestJson<ManagedUser>("/api/users/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function deactivateUser(id: number): Promise<ManagedUser> {
  return requestJson<ManagedUser>(`/api/users/${id}/deactivate/`, {
    method: "POST",
  });
}

export async function resetPassword(
  id: number,
  newPassword: string,
): Promise<{ detail: string }> {
  return requestJson<{ detail: string }>(`/api/users/${id}/reset-password/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export async function listPharmaciesForPicker(): Promise<PharmacyOption[]> {
  return requestJson<PharmacyOption[]>("/api/tenancy/pharmacies/");
}
