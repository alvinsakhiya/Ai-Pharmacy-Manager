import type { MePayload } from "../types/auth";

export function scopeLabel(user: MePayload): string {
  if (user.scope.is_global) {
    return "Global access";
  }

  if (
    (user.role === "PHARMACIST" || user.role === "DISPENSER") &&
    user.pharmacies.length === 1
  ) {
    return user.pharmacies[0].name;
  }

  if (user.role && user.pharmacies.length > 0) {
    return `Group access — ${user.pharmacies.length} pharmacies`;
  }

  return "No assigned pharmacy";
}
