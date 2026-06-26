import type { WorkQueueItem, WorkQueuePriority } from "./notificationsApi";

const STATUS_LABELS: Record<string, string> = {
  OVERDUE: "Overdue",
  NEEDS_ATTENTION: "Needs attention",
  DUE_SOON: "Due soon",
  WAITING_CHECK: "Waiting for check",
  STOCK_ACTION: "Stock/action required",
  PENDING: "Pending",
  CRITICAL: "Needs attention",
  WARNING: "Needs attention",
  INFO: "For review",
};

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function humanizeWorkQueueValue(value: string): string {
  return titleCase(value.replace(/_/g, " ").trim());
}

export function formatWorkQueueDate(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDateOnly(value));
}

export function formatWorkQueueDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function workQueuePriorityLabel(priority: WorkQueuePriority): string {
  return humanizeWorkQueueValue(priority);
}

export function workQueueStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? humanizeWorkQueueValue(status);
}

export function workQueueTypeLabel(type: string): string {
  return humanizeWorkQueueValue(type);
}

export function workQueueActionLabel(item: WorkQueueItem): string {
  if (item.type.startsWith("MDS_")) {
    return "Open Dosette";
  }
  if (item.type.startsWith("REVIEW_")) {
    return "Open Pharmacist Reviews";
  }
  if (item.type.startsWith("STOCK_")) {
    return "Open Inventory";
  }
  return item.action_label || "Open record";
}
