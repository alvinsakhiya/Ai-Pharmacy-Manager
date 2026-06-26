import type { BadgeVariant } from "../../components/ui/Badge";
import type { Alert, AlertCategory, AlertSeverity } from "./notificationsApi";

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export const ALERT_SEVERITY_BADGE: Record<AlertSeverity, BadgeVariant> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  stock: "Stock",
  dosette: "Dosette",
};

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function alertTypeLabel(type: string): string {
  return titleCase(type.replace(/_/g, " "));
}

export function alertAction(alert: Alert): { href: string; label: string } {
  if (alert.category === "dosette") {
    return {
      href: "/work-queue",
      label: "Open Work Queue",
    };
  }

  if (alert.subject.stock_item_id) {
    return {
      href: `/inventory/${alert.subject.stock_item_id}`,
      label: "Open Inventory",
    };
  }

  return {
    href: "/alerts",
    label: "Open record",
  };
}

export function alertScopeLabel(alert: Alert): string {
  return `Pharmacy ${alert.pharmacy_id}`;
}
