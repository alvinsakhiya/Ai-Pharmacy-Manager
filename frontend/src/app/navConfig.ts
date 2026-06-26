import {
  Bell,
  Boxes,
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Pill,
  ScrollText,
  Settings,
  TrendingUp,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavGroup =
  | "Overview"
  | "Inventory"
  | "Operations"
  | "Administration"
  | "System";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  group: NavGroup;
  requiredAnyOf?: string[];
}

export interface FutureNavItem {
  label: string;
  icon: LucideIcon;
}

/** Order in which groups render in the sidebar. */
export const NAV_GROUP_ORDER: NavGroup[] = [
  "Overview",
  "Inventory",
  "Operations",
  "Administration",
  "System",
];

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    group: "Overview",
  },
  {
    label: "Medication Catalogue",
    path: "/catalogue",
    icon: Pill,
    group: "Administration",
    requiredAnyOf: ["medication.manage"],
  },
  {
    label: "Inventory",
    path: "/inventory",
    icon: Boxes,
    group: "Inventory",
    requiredAnyOf: ["stock.view"],
  },
  {
    label: "Stock Intelligence",
    path: "/analytics",
    icon: TrendingUp,
    group: "Inventory",
    requiredAnyOf: ["stock.view"],
  },
  {
    label: "Reports",
    path: "/reports",
    icon: FileText,
    group: "Operations",
    requiredAnyOf: ["stock.view"],
  },
  {
    label: "Alerts",
    path: "/alerts",
    icon: Bell,
    group: "Operations",
    requiredAnyOf: ["stock.view", "blister.view"],
  },
  {
    label: "Pharmacist Reviews",
    path: "/reviews",
    icon: ClipboardCheck,
    group: "Operations",
    requiredAnyOf: ["review.view"],
  },
  {
    label: "Patients",
    path: "/patients",
    icon: UserRound,
    group: "Operations",
    requiredAnyOf: ["patient.view"],
  },
  {
    label: "Users",
    path: "/users",
    icon: Users,
    group: "Administration",
    requiredAnyOf: ["user.manage"],
  },
  {
    label: "Organisation",
    path: "/tenancy",
    icon: Building2,
    group: "Administration",
    requiredAnyOf: ["group.manage", "pharmacy.manage"],
  },
  {
    label: "Audit Log",
    path: "/audit",
    icon: ScrollText,
    group: "System",
    requiredAnyOf: ["audit.view"],
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
    group: "System",
  },
];

export const FUTURE_ITEMS: FutureNavItem[] = [];
