export interface NavItem {
  label: string;
  path: string;
  requiredAnyOf?: string[];
}

export interface FutureNavItem {
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/",
  },
  {
    label: "Users",
    path: "/users",
    requiredAnyOf: ["user.manage"],
  },
  {
    label: "Organisation",
    path: "/tenancy",
    requiredAnyOf: ["group.manage", "pharmacy.manage"],
  },
  {
    label: "Medications",
    path: "/catalogue",
    requiredAnyOf: ["medication.view"],
  },
  {
    label: "Inventory",
    path: "/inventory",
    requiredAnyOf: ["stock.view"],
  },
  {
    label: "Stock Intelligence",
    path: "/analytics",
    requiredAnyOf: ["stock.view"],
  },
  {
    label: "Reports",
    path: "/reports",
    requiredAnyOf: ["stock.view"],
  },
  {
    label: "Patients",
    path: "/patients",
    requiredAnyOf: ["patient.view"],
  },
  {
    label: "Audit Log",
    path: "/audit",
    requiredAnyOf: ["audit.view"],
  },
];

export const FUTURE_ITEMS: FutureNavItem[] = [
  { label: "Dosette/MDS" },
  { label: "Clinical Review" },
  { label: "Notifications" },
  { label: "Settings" },
];
