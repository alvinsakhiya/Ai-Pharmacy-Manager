import { useQuery } from "@tanstack/react-query";

import {
  getStockAttentionReport,
  getStockMovementsReport,
} from "./reportsApi";

export function useStockAttentionReportQuery() {
  return useQuery({
    queryKey: ["reports", "stock-attention"],
    queryFn: getStockAttentionReport,
  });
}

export function useStockMovementsReportQuery() {
  return useQuery({
    queryKey: ["reports", "stock-movements"],
    queryFn: getStockMovementsReport,
  });
}
