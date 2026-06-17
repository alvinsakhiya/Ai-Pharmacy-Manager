import type { MePayload } from "../../types/auth";

export interface RoleOption {
  value: string;
  label: string;
}

const ADMIN_ROLE_OPTIONS: RoleOption[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "SUPERINTENDENT", label: "Superintendent" },
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "DISPENSER", label: "Dispenser" },
  { value: "STOCK_EMPLOYEE", label: "Stock employee" },
];

const PHARMACIST_ROLE_OPTIONS: RoleOption[] = [
  { value: "PHARMACIST", label: "Pharmacist" },
  { value: "DISPENSER", label: "Dispenser" },
];

export function roleOptionsFor(user: MePayload | null): RoleOption[] {
  if (user?.scope.is_global) {
    return ADMIN_ROLE_OPTIONS;
  }
  return PHARMACIST_ROLE_OPTIONS;
}
