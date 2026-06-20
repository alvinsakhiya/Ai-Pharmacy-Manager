import { apiFetch } from "../../lib/api";
import { requestJson } from "../../lib/apiClient";
import type {
  StockAnalyticsItem,
  StockAnalyticsSummary,
  StockAnalyticsThresholds,
} from "../analytics/analyticsApi";

export interface StockAttentionReport {
  report: string;
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
  report: string;
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

export const STOCK_ATTENTION_CSV_PATH = "/api/reports/stock/attention.csv";
export const STOCK_MOVEMENTS_CSV_PATH = "/api/reports/stock/movements.csv";

export function getStockAttentionReport(): Promise<StockAttentionReport> {
  return requestJson<StockAttentionReport>("/api/reports/stock/attention/");
}

export function getStockMovementsReport(): Promise<StockMovementsReport> {
  return requestJson<StockMovementsReport>("/api/reports/stock/movements/");
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
