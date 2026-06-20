import { useQuery } from "@tanstack/react-query";

import { getStockAnalyticsOverview } from "./analyticsApi";

export function useStockAnalyticsOverviewQuery(pharmacyId?: number) {
  return useQuery({
    queryKey: ["analytics", "stock-overview", pharmacyId ?? null],
    queryFn: () => getStockAnalyticsOverview(pharmacyId),
  });
}
