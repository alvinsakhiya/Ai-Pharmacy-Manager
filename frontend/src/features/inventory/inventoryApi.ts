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

export interface MovementSummary {
  id: number;
  movement_type: string;
  quantity_delta: number;
  balance_after: number;
  batch: number | null;
}

export interface ReceiveStockBody {
  pharmacy: number;
  medication: number;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  received_at?: string;
  unit_price?: string | null;
  reason?: string;
  reference?: string;
}

export interface ReceiveStockResponse {
  stock_item: StockItemDetail;
  movement: MovementSummary;
}

export interface CatalogueStockIntakeBody {
  pharmacy: number;
  catalogue_product: number;
  packs_received: number;
  batch_number: string;
  expiry_date: string;
  received_at?: string;
  reason?: string;
  reference?: string;
}

export interface CatalogueStockIntakeResponse {
  stock_item: StockItemDetail;
  movement: MovementSummary;
  intake: {
    packs_received: number;
    pack_size: number;
    pack_unit: string;
    quantity_received: number;
  };
}

export interface AdjustBatchBody {
  delta: number;
  reason: string;
  reference?: string;
}

export interface AdjustBatchResponse {
  stock_item: StockItemDetail;
  movement: MovementSummary;
}

export interface CountBatchBody {
  counted_quantity: number;
  reason?: string;
  reference?: string;
}

export interface CountBatchResponse {
  stock_item: StockItemDetail;
  movement: MovementSummary | null;
  changed: boolean;
}

export interface TransferBatchBody {
  destination_pharmacy: number;
  quantity: number;
  reason?: string;
  reference?: string;
}

export interface TransferBatchResponse {
  source_stock_item: StockItemDetail;
  destination_stock_item: StockItemDetail;
  transfer: {
    quantity: number;
    out_movement: MovementSummary;
    in_movement: MovementSummary;
  };
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

export function receiveStock(
  body: ReceiveStockBody,
): Promise<ReceiveStockResponse> {
  return requestJson<ReceiveStockResponse>("/api/inventory/receipts/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function receiveCatalogueStock(
  body: CatalogueStockIntakeBody,
): Promise<CatalogueStockIntakeResponse> {
  return requestJson<CatalogueStockIntakeResponse>("/api/inventory/stock/intake/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function adjustBatch(
  batchId: number,
  body: AdjustBatchBody,
): Promise<AdjustBatchResponse> {
  return requestJson<AdjustBatchResponse>(
    `/api/inventory/batches/${batchId}/adjust/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

export function countBatch(
  batchId: number,
  body: CountBatchBody,
): Promise<CountBatchResponse> {
  return requestJson<CountBatchResponse>(
    `/api/inventory/batches/${batchId}/count/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

export function transferBatch(
  batchId: number,
  body: TransferBatchBody,
): Promise<TransferBatchResponse> {
  return requestJson<TransferBatchResponse>(
    `/api/inventory/batches/${batchId}/transfer/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}
