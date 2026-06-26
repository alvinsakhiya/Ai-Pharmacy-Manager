import { requestJson } from "../../lib/apiClient";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory = "stock" | "dosette";

export interface AlertSubject {
  stock_item_id?: number;
  medication_id?: number;
  medication_name?: string;
  dosette_cycle_id?: number;
  cycle_reference?: string;
  patient_id?: number;
  patient_reference?: string;
}

export interface Alert {
  id: string;
  category: AlertCategory;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  pharmacy_id: number;
  subject: AlertSubject;
}

export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  by_category: {
    stock: number;
    dosette: number;
  };
}

export interface AlertsResponse {
  generated_at: string;
  summary: AlertSummary;
  alerts: Alert[];
}

export type WorkQueuePriority = "urgent" | "high" | "medium" | "low";
export type WorkQueueGroup =
  | "urgent"
  | "due_soon"
  | "waiting_check"
  | "stock_action"
  | "reviews";

export interface WorkQueueSummary {
  total: number;
  urgent: number;
  due_soon: number;
  waiting_check: number;
  stock_action: number;
  reviews: number;
}

export interface WorkQueueItem {
  id: string;
  type: string;
  group: WorkQueueGroup;
  priority: WorkQueuePriority;
  title: string;
  reason: string;
  pharmacy_id: number;
  pharmacy_name: string;
  patient_reference: string;
  cycle_id: number | null;
  cycle_reference: string | null;
  cycle_display_label: string;
  cycle_start_date: string | null;
  cycle_end_date: string | null;
  due_date: string | null;
  status: string;
  action_label: string;
  action_href: string;
}

export interface WorkQueueResponse {
  generated_at: string;
  summary: WorkQueueSummary;
  items: WorkQueueItem[];
}

export interface AlertDismissResponse {
  fingerprint: string;
  dismissed: boolean;
  created: boolean;
  summary: AlertSummary;
}

export interface AlertClearResponse {
  dismissed_count: number;
  created_count: number;
  summary: AlertSummary;
}

export function getAlerts(): Promise<AlertsResponse> {
  return requestJson<AlertsResponse>("/api/notifications/alerts/");
}

export function getWorkQueue(): Promise<WorkQueueResponse> {
  return requestJson<WorkQueueResponse>("/api/notifications/work-queue/");
}

export function dismissAlert(fingerprint: string): Promise<AlertDismissResponse> {
  return requestJson<AlertDismissResponse>("/api/notifications/alerts/dismiss/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fingerprint }),
  });
}

export function clearAlerts(fingerprints?: string[]): Promise<AlertClearResponse> {
  return requestJson<AlertClearResponse>("/api/notifications/alerts/clear/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fingerprints ? { fingerprints } : {}),
  });
}
