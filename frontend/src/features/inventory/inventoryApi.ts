import { requestJson } from "../../lib/apiClient";

export interface StockBatch {
  id: number;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  quantity_received: number;
  received_at: string;
  is_active: boolean;
}

export interface StockItem {
  id: number;
  pharmacy: number;
  medication: number;
  medication_name: string;
  unit_price: string | null;
  reorder_level: number;
  is_active: boolean;
  quantity_on_hand: number;
  earliest_expiry: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockItemDetail extends StockItem {
  batches: StockBatch[];
}

export function listStockItems(params?: {
  pharmacy?: number;
}): Promise<StockItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.pharmacy !== undefined) {
    searchParams.set("pharmacy", String(params.pharmacy));
  }
  const query = searchParams.toString();

  return requestJson<StockItem[]>(
    `/api/inventory/stock-items/${query ? `?${query}` : ""}`,
  );
}

export function getStockItem(id: number): Promise<StockItemDetail> {
  return requestJson<StockItemDetail>(`/api/inventory/stock-items/${id}/`);
}
