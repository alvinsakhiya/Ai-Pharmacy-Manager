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
  "/stock-movements": [
    PharmacyRole.MANAGER,
    PharmacyRole.STOCK_ASSISTANT,
  ],
  "/clinical-reviews": [
    PharmacyRole.MANAGER,
    PharmacyRole.PHARMACIST,
  ],
  "/notifications": allRoles,
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
  "/stock-intelligence": [
    PharmacyRole.MANAGER,
    PharmacyRole.STOCK_ASSISTANT,
  ],
  "/audit-log": [PharmacyRole.MANAGER],
};

export function canAccessPath(user, path) {
  const allowedRoles = pageRoles[path] || [];
  const assignedRoles = user?.roles || [];

  return assignedRoles.some((role) => allowedRoles.includes(role));
}

export function canManageInventory(user) {
  return [PharmacyRole.MANAGER, PharmacyRole.STOCK_ASSISTANT].some((role) =>
    user?.roles?.includes(role)
  );
}

export function canManageNotifications(user) {
  return user?.roles?.includes(PharmacyRole.MANAGER) || false;
}
