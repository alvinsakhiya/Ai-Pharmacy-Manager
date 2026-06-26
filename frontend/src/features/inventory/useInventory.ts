import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adjustBatch,
  countBatch,
  getStockItem,
  listStockItems,
  receiveCatalogueStock,
  receiveStock,
  transferBatch,
  type AdjustBatchBody,
  type CatalogueStockIntakeBody,
  type CountBatchBody,
  type ReceiveStockBody,
  type TransferBatchBody,
} from "./inventoryApi";

export function useStockItemsQuery(pharmacyId?: number, search = "") {
  const normalizedSearch = search.trim();

  return useQuery({
    queryKey: ["stock-items", "list", pharmacyId ?? null, normalizedSearch],
    queryFn: () => {
      const params: { pharmacy?: number; search?: string } = {};
      if (pharmacyId !== undefined) {
        params.pharmacy = pharmacyId;
      }
      if (normalizedSearch) {
        params.search = normalizedSearch;
      }
      return Object.keys(params).length > 0
        ? listStockItems(params)
        : listStockItems();
    },
  });
}

export function useStockItemQuery(id: number) {
  return useQuery({
    queryKey: ["stock-items", "detail", id],
    queryFn: () => getStockItem(id),
    enabled: Number.isFinite(id),
  });
}

export function useReceiveStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ReceiveStockBody) => receiveStock(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

export function useReceiveCatalogueStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CatalogueStockIntakeBody) => receiveCatalogueStock(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

export function useAdjustBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, body }: { batchId: number; body: AdjustBatchBody }) =>
      adjustBatch(batchId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

export function useCountBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, body }: { batchId: number; body: CountBatchBody }) =>
      countBatch(batchId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}

export function useTransferBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      batchId,
      body,
    }: {
      batchId: number;
      body: TransferBatchBody;
    }) => transferBatch(batchId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
  });
}
