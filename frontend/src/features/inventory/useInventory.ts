import { useQuery } from "@tanstack/react-query";

import { getStockItem, listStockItems } from "./inventoryApi";

export function useStockItemsQuery(pharmacyId?: number) {
  return useQuery({
    queryKey: ["stock-items", "list", pharmacyId ?? null],
    queryFn: () =>
      pharmacyId ? listStockItems({ pharmacy: pharmacyId }) : listStockItems(),
  });
}

export function useStockItemQuery(id: number) {
  return useQuery({
    queryKey: ["stock-items", "detail", id],
    queryFn: () => getStockItem(id),
    enabled: Number.isFinite(id),
  });
}
