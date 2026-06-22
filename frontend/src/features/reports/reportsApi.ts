import { apiFetch } from "../../lib/api";
import { requestJson } from "../../lib/apiClient";
import type {
  StockAnalyticsItem,
  StockAnalyticsSummary,
  StockAnalyticsThresholds,
} from "../analytics/analyticsApi";

export interface StockAttentionReport {
  report: "stock_attention";
  generated_at: string;
  thresholds: StockAnalyticsThresholds;
  filters: {
    pharmacy_id: number | null;
    flag: string | null;
    needs_attention: boolean;
  };
  summary: StockAnalyticsSummary;
  row_count: number;
  rows: StockAnalyticsItem[];
}

export interface StockMovementRow {
  movement_id: number;
  created_at: string;
  stock_item_id: number;
  medication_id: number;
  medication_name: string;
  pharmacy_id: number;
  batch_id: number | null;
  batch_number: string | null;
  movement_type: string;
  quantity_delta: number;
  balance_after: number;
  reference: string;
}

export interface StockMovementsReport {
  report: "stock_movements";
  generated_at: string;
  filters: {
    pharmacy_id: number | null;
    medication_id: number | null;
    stock_item_id: number | null;
    movement_type: string | null;
    date_from: string | null;
    date_to: string | null;
    limit: number;
  };
  row_count: number;
  limited: boolean;
  rows: StockMovementRow[];
}

export interface ReportDashboardCard {
  report: ReportId;
  title: string;
  row_count: number;
  available_exports: string[];
  human_review_required: boolean;
}

export interface ReportsDashboard {
  report: "dashboard";
  generated_at: string;
  filters: {
    pharmacy_id: number | null;
    group_id: number | null;
  };
  cards: ReportDashboardCard[];
}

export interface ExpiryReportRow {
  pharmacy_id: number;
  pharmacy_name: string;
  medication_label: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  days_until_expiry: number;
  severity: string;
}

export interface ExpiryReport {
  report: "expiry";
  generated_at: string;
  filters: {
    pharmacy_id: number | null;
    window_days: number;
  };
  row_count: number;
  rows: ExpiryReportRow[];
}

export interface DeadStockReportRow {
  pharmacy_id: number;
  medication_label: string;
  quantity_on_hand: number;
  days_since_last_outbound: number | null;
  status: "dead" | "slow" | "active";
  suggested_action: string;
}

export interface DeadStockReport {
  report: "dead_stock";
  generated_at: string;
  filters: {
    pharmacy_id: number | null;
    window_days: number;
  };
  row_count: number;
  rows: DeadStockReportRow[];
}

export interface ForecastReorderReportRow {
  pharmacy_id: number;
  pharmacy_name: string;
  medication_label: string;
  predicted_usage_units: number;
  current_stock_units: number;
  suggested_reorder_units: number;
  suggested_reorder_packs: number | null;
  confidence: string;
  explanation_summary: string;
  human_review_required: boolean;
  forecast_run_id: number;
  forecast_created_at: string;
}

export interface ForecastReorderReport {
  report: "forecast_reorder";
  generated_at: string;
  filters: {
    pharmacy_id: number | null;
  };
  row_count: number;
  rows: ForecastReorderReportRow[];
}

export interface TransferSuggestionsReportRow {
  group_id: number;
  group_name: string;
  source_pharmacy_id: number;
  source_pharmacy_name: string;
  destination_pharmacy_id: number;
  destination_pharmacy_name: string;
  medication_label: string;
  suggested_quantity_units: number;
  suggested_quantity_packs: number | null;
  confidence: string;
  status: "OPEN" | "DISMISSED" | "ACTIONED";
  reason: string;
  created_at: string;
  human_review_required: boolean;
}

export interface TransferSuggestionsReport {
  report: "transfer_suggestions";
  generated_at: string;
  filters: {
    group_id: number | null;
    status: string | null;
  };
  row_count: number;
  rows: TransferSuggestionsReportRow[];
}

export interface MdsWorkloadReportRow {
  pharmacy_id: number;
  pharmacy_name: string;
  cycle_status: string;
  due_count: number;
  overdue_count: number;
  upcoming_cycles: number;
}

export interface MdsWorkloadReport {
  report: "mds_workload";
  generated_at: string;
  filters: {
    pharmacy_id: number | null;
    window_days: number;
  };
  row_count: number;
  rows: MdsWorkloadReportRow[];
}

export type ReportPreview =
  | StockAttentionReport
  | StockMovementsReport
  | ExpiryReport
  | DeadStockReport
  | ForecastReorderReport
  | TransferSuggestionsReport
  | MdsWorkloadReport;

export type ReportId =
  | "stock_attention"
  | "stock_movements"
  | "expiry"
  | "dead_stock"
  | "forecast_reorder"
  | "transfer_suggestions"
  | "mds_workload";

export interface ReportFilters {
  pharmacyId?: number;
  groupId?: number;
  days?: number;
  status?: string;
}

export const STOCK_ATTENTION_CSV_PATH = "/api/reports/stock/attention.csv";
export const STOCK_MOVEMENTS_CSV_PATH = "/api/reports/stock/movements.csv";
export const EXPIRY_CSV_PATH = "/api/reports/expiry.csv";
export const DEAD_STOCK_CSV_PATH = "/api/reports/dead-stock.csv";
export const FORECAST_REORDER_CSV_PATH = "/api/reports/forecast-reorder.csv";
export const TRANSFER_SUGGESTIONS_CSV_PATH =
  "/api/reports/transfer-suggestions.csv";
export const MDS_WORKLOAD_CSV_PATH = "/api/reports/mds-workload.csv";

export function getStockAttentionReport(): Promise<StockAttentionReport> {
  return requestJson<StockAttentionReport>("/api/reports/stock/attention/");
}

export function getStockMovementsReport(): Promise<StockMovementsReport> {
  return requestJson<StockMovementsReport>("/api/reports/stock/movements/");
}

function buildQuery(filters: ReportFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.pharmacyId !== undefined) {
    params.set("pharmacy", String(filters.pharmacyId));
  }
  if (filters.groupId !== undefined) {
    params.set("group", String(filters.groupId));
  }
  if (filters.days !== undefined) {
    params.set("days", String(filters.days));
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

const REPORT_PATHS: Record<ReportId, string> = {
  stock_attention: "/api/reports/stock/attention/",
  stock_movements: "/api/reports/stock/movements/",
  expiry: "/api/reports/expiry/",
  dead_stock: "/api/reports/dead-stock/",
  forecast_reorder: "/api/reports/forecast-reorder/",
  transfer_suggestions: "/api/reports/transfer-suggestions/",
  mds_workload: "/api/reports/mds-workload/",
};

export const REPORT_CSV_PATHS: Record<ReportId, string> = {
  stock_attention: STOCK_ATTENTION_CSV_PATH,
  stock_movements: STOCK_MOVEMENTS_CSV_PATH,
  expiry: EXPIRY_CSV_PATH,
  dead_stock: DEAD_STOCK_CSV_PATH,
  forecast_reorder: FORECAST_REORDER_CSV_PATH,
  transfer_suggestions: TRANSFER_SUGGESTIONS_CSV_PATH,
  mds_workload: MDS_WORKLOAD_CSV_PATH,
};

export function getReportsDashboard(
  filters: ReportFilters = {},
): Promise<ReportsDashboard> {
  return requestJson<ReportsDashboard>(`/api/reports/dashboard/${buildQuery(filters)}`);
}

export function getReportPreview(
  reportId: ReportId,
  filters: ReportFilters = {},
): Promise<ReportPreview> {
  return requestJson<ReportPreview>(`${REPORT_PATHS[reportId]}${buildQuery(filters)}`);
}

export function reportCsvPath(reportId: ReportId, filters: ReportFilters = {}) {
  return `${REPORT_CSV_PATHS[reportId]}${buildQuery(filters)}`;
}

export async function downloadReportCsv(
  path: string,
  filename: string,
): Promise<void> {
  const response = await apiFetch(path);

  if (!response.ok) {
    throw new Error("Report download failed.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
