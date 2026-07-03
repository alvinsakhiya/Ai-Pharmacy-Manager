import { requestJson } from "../../lib/apiClient";

export { ApiError } from "../../lib/apiClient";

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
  group: number;
}

export interface GroupOption {
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

export interface AssignMembershipBody {
  role: string;
  group_id?: number;
  pharmacy_id?: number;
  pharmacy_ids?: number[];
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

export async function listGroupsForPicker(): Promise<GroupOption[]> {
  return requestJson<GroupOption[]>("/api/tenancy/groups/");
}

export async function assignMembership(
  id: number,
  body: AssignMembershipBody,
): Promise<ManagedUser> {
  return requestJson<ManagedUser>(`/api/users/${id}/assign-membership/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
