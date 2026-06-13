export const PharmacyRole = {
  MANAGER: "Manager",
  PHARMACIST: "Pharmacist",
  DISPENSER: "Dispenser",
  STOCK_ASSISTANT: "Stock Assistant",
  READ_ONLY: "Read-only User",
};

const allRoles = Object.values(PharmacyRole);

export const pageRoles = {
  "/": allRoles,
  "/patients": [
    PharmacyRole.MANAGER,
    PharmacyRole.PHARMACIST,
    PharmacyRole.DISPENSER,
    PharmacyRole.READ_ONLY,
  ],
  "/inventory": allRoles,
  "/dosette": [
    PharmacyRole.MANAGER,
    PharmacyRole.PHARMACIST,
    PharmacyRole.DISPENSER,
    PharmacyRole.READ_ONLY,
  ],
  "/picking-lists": [
    PharmacyRole.MANAGER,
    PharmacyRole.PHARMACIST,
    PharmacyRole.DISPENSER,
  ],
  "/alerts": [
    PharmacyRole.MANAGER,
    PharmacyRole.PHARMACIST,
    PharmacyRole.STOCK_ASSISTANT,
    PharmacyRole.READ_ONLY,
  ],
  "/forecasts": [
    PharmacyRole.MANAGER,
    PharmacyRole.PHARMACIST,
    PharmacyRole.READ_ONLY,
  ],
  "/audit-log": [PharmacyRole.MANAGER],
};

export function canAccessPath(user, path) {
  const allowedRoles = pageRoles[path] || [];
  const assignedRoles = user?.roles || [];

  return assignedRoles.some((role) => allowedRoles.includes(role));
}
