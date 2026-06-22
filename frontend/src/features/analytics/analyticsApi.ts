import { requestJson } from "../../lib/apiClient";

export interface StockAnalyticsFlags {
  near_expiry: boolean;
  low_stock: boolean;
  stockout: boolean;
  dead_stock: boolean;
  slow_moving: boolean;
}

export interface StockAnalyticsItem {
  stock_item_id: number;
  medication_id: number;
  medication_name: string;
  pharmacy_id: number;
  quantity_on_hand: number;
  reorder_level: number;
  earliest_expiry: string | null;
  days_to_expiry: number | null;
  consumption_window: number;
  flags: StockAnalyticsFlags;
  attention_score: number;
  suggested_reorder_quantity: number;
  reasons: string[];
}

export interface StockAnalyticsSummary {
  total_items: number;
  stockout: number;
  low_stock: number;
  near_expiry: number;
  dead_stock: number;
  slow_moving: number;
  needs_attention: number;
}

export interface StockAnalyticsThresholds {
  near_expiry_days: number;
  dead_stock_days: number;
  slow_moving_threshold: number;
}

export interface StockOverview {
  generated_at: string;
  thresholds: StockAnalyticsThresholds;
  summary: StockAnalyticsSummary;
  items: StockAnalyticsItem[];
}

export interface ForecastItem {
  id: number;
  stock_item: number;
  catalogue_product: number | null;
  medication_label: string;
  predicted_usage_units: number;
  predicted_usage_packs: string | null;
  current_stock_units: number;
  current_stock_packs: string | null;
  safety_stock_units: number;
  suggested_reorder_units: number;
  suggested_reorder_packs: number | null;
  confidence: string;
  explanation: string;
  history_points_count: number;
  window_days: number;
  created_at: string;
}

export interface ForecastRun {
  id: number;
  pharmacy: number;
  group: number;
  horizon_days: number;
  lookback_days: number;
  model_version: string;
  is_demo: boolean;
  generated_by: number | null;
  status: string;
  created_at: string;
  items: ForecastItem[];
}

export interface TransferSuggestion {
  id: number;
  group: number;
  catalogue_product: number | null;
  medication_label: string;
  source_pharmacy: number;
  source_pharmacy_name: string;
  destination_pharmacy: number;
  destination_pharmacy_name: string;
  source_stock_item: number | null;
  destination_stock_item: number | null;
  suggested_quantity_units: number;
  suggested_quantity_packs: number | null;
  current_source_stock_units: number;
  destination_recent_usage_units: number;
  dead_days: number;
  confidence: string;
  reason: string;
  status: "OPEN" | "DISMISSED" | "ACTIONED";
  model_version: string;
  generated_by: number | null;
  created_at: string;
  updated_at: string;
}

export function getStockAnalyticsOverview(
  pharmacyId?: number,
): Promise<StockOverview> {
  const query = pharmacyId ? `?pharmacy=${pharmacyId}` : "";
  return requestJson<StockOverview>(`/api/analytics/stock/overview/${query}`);
}

export async function getLatestForecast(
  pharmacyId: number,
): Promise<ForecastRun | null> {
  const response = await requestJson<ForecastRun | { detail: string }>(
    `/api/analytics/forecasts/latest/?pharmacy=${pharmacyId}`,
  );
  return "items" in response ? response : null;
}

export function generateForecast(body: {
  pharmacy: number;
  horizon_days: number;
}): Promise<ForecastRun> {
  return requestJson<ForecastRun>("/api/analytics/forecasts/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function listTransferSuggestions(
  groupId: number,
): Promise<TransferSuggestion[]> {
  return requestJson<TransferSuggestion[]>(
    `/api/analytics/transfer-suggestions/?group=${groupId}`,
  );
}

export function generateTransferSuggestions(body: {
  group: number;
  dead_days: number;
}): Promise<TransferSuggestion[]> {
  return requestJson<TransferSuggestion[]>("/api/analytics/transfer-suggestions/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function dismissTransferSuggestion(
  suggestionId: number,
): Promise<TransferSuggestion> {
  return requestJson<TransferSuggestion>(
    `/api/analytics/transfer-suggestions/${suggestionId}/dismiss/`,
    {
      method: "POST",
    },
  );
}
