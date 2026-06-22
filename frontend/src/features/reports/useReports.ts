import { useQuery } from "@tanstack/react-query";

import {
  getReportPreview,
  getReportsDashboard,
  getStockAttentionReport,
  getStockMovementsReport,
  type ReportFilters,
  type ReportId,
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

export function useReportsDashboardQuery(filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "dashboard", filters],
    queryFn: () => getReportsDashboard(filters),
  });
}

export function useReportPreviewQuery(reportId: ReportId, filters: ReportFilters) {
  return useQuery({
    queryKey: ["reports", "preview", reportId, filters],
    queryFn: () => getReportPreview(reportId, filters),
  });
}
