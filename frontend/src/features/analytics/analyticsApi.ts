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

export interface MdsDemandSummary {
  total_required_units: number;
  total_available_units: number;
  total_shortfall_units: number;
  items_with_shortfall: number;
  mapping_needed: number;
  cycles_affected: number;
  patients_affected: number;
}

export interface MdsDemandItem {
  stock_item_id: number | null;
  medication_id: number;
  medication_name: string;
  pharmacy_id: number;
  pharmacy_name: string;
  required_units: number;
  available_units: number;
  shortfall_units: number;
  cycles_affected: number;
  patients_affected: number;
  mapping_status: "mapped" | "mapping_needed";
  review_message: string;
}

export interface MdsDemandSignal {
  generated_at: string;
  horizon_days: number;
  summary: MdsDemandSummary;
  items: MdsDemandItem[];
}

export interface ExpiryRiskSummary {
  expiring_within_30_days_units: number;
  value_at_risk: string;
  unpriced_risk_units: number;
  products_affected: number;
}

export interface ExpiryRiskBucket {
  key: string;
  label: string;
  units: number;
  estimated_value: string;
  unpriced_units: number;
  batch_count: number;
  product_count: number;
}

export interface ExpiryRiskItem {
  stock_item_id: number;
  medication_id: number;
  medication_name: string;
  pharmacy_id: number;
  pharmacy_name: string;
  batch_number: string;
  expiry_date: string;
  days_to_expiry: number;
  quantity: number;
  bucket: string;
  bucket_label: string;
  estimated_value: string;
  unpriced_units: number;
  review_message: string;
}

export interface ExpiryRisk {
  generated_at: string;
  summary: ExpiryRiskSummary;
  buckets: ExpiryRiskBucket[];
  items: ExpiryRiskItem[];
}

export interface StockReviewQueueSummary {
  total_items: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  mds_shortfall: number;
  expiry_risk: number;
  low_confidence: number;
}

export interface StockReviewQueueItem {
  stock_item_id: number | null;
  medication_id: number;
  medication_name: string;
  pharmacy_id: number;
  pharmacy_name: string;
  score: number;
  risk_level: "high" | "medium" | "low";
  reason_chips: string[];
  signals: string[];
  required_units: number;
  available_units: number;
  shortfall_units: number;
  forecast_confidence: string | null;
  forecast_confidence_label: string | null;
  review_message: string;
}

export interface StockReviewQueue {
  generated_at: string;
  horizon_days: number;
  summary: StockReviewQueueSummary;
  items: StockReviewQueueItem[];
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

function signalQuery(pharmacyId?: number, horizonDays?: number): string {
  const params = new URLSearchParams();
  if (pharmacyId !== undefined) {
    params.set("pharmacy", String(pharmacyId));
  }
  if (horizonDays !== undefined) {
    params.set("horizon_days", String(horizonDays));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getMdsDemandSignal(
  pharmacyId?: number,
  horizonDays = 28,
): Promise<MdsDemandSignal> {
  return requestJson<MdsDemandSignal>(
    `/api/analytics/mds-demand/${signalQuery(pharmacyId, horizonDays)}`,
  );
}

export function getExpiryRisk(pharmacyId?: number): Promise<ExpiryRisk> {
  return requestJson<ExpiryRisk>(
    `/api/analytics/expiry-risk/${signalQuery(pharmacyId)}`,
  );
}

export function getStockReviewQueue(
  pharmacyId?: number,
  horizonDays = 28,
): Promise<StockReviewQueue> {
  return requestJson<StockReviewQueue>(
    `/api/analytics/stock-review-queue/${signalQuery(pharmacyId, horizonDays)}`,
  );
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
