export interface AuthScope {
  is_global: boolean;
  group_ids: number[];
  pharmacy_ids: number[];
}

export interface AuthPharmacy {
  id: number;
  name: string;
}

export interface MePayload {
  id: number;
  email: string;
  full_name: string;
  must_change_password: boolean;
  role: string | null;
  scope: AuthScope;
  pharmacies: AuthPharmacy[];
  permissions: Record<string, boolean>;
}
