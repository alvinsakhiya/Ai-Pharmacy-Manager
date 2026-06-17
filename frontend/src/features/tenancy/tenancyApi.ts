import { requestJson } from "../../lib/apiClient";

export interface Group {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupWriteBody {
  name: string;
  slug: string;
  is_active: boolean;
}

export interface Pharmacy {
  id: number;
  group: number;
  name: string;
  code: string;
  address: string;
  postcode: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PharmacyWriteBody {
  group: number;
  name: string;
  code: string;
  address: string;
  postcode: string;
  is_active: boolean;
}

export async function listGroups(): Promise<Group[]> {
  return requestJson<Group[]>("/api/tenancy/groups/");
}

export async function createGroup(body: GroupWriteBody): Promise<Group> {
  return requestJson<Group>("/api/tenancy/groups/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function updateGroup(
  id: number,
  body: GroupWriteBody,
): Promise<Group> {
  return requestJson<Group>(`/api/tenancy/groups/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function listPharmacies(): Promise<Pharmacy[]> {
  return requestJson<Pharmacy[]>("/api/tenancy/pharmacies/");
}

export async function createPharmacy(
  body: PharmacyWriteBody,
): Promise<Pharmacy> {
  return requestJson<Pharmacy>("/api/tenancy/pharmacies/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function updatePharmacy(
  id: number,
  body: PharmacyWriteBody,
): Promise<Pharmacy> {
  return requestJson<Pharmacy>(`/api/tenancy/pharmacies/${id}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
