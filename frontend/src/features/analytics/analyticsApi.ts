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

export function getStockAnalyticsOverview(
  pharmacyId?: number,
): Promise<StockOverview> {
  const query = pharmacyId ? `?pharmacy=${pharmacyId}` : "";
  return requestJson<StockOverview>(`/api/analytics/stock/overview/${query}`);
}
