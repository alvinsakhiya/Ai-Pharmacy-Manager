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

export function getAlerts(): Promise<AlertsResponse> {
  return requestJson<AlertsResponse>("/api/notifications/alerts/");
}
