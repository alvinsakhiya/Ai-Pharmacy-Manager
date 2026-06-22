import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  generateForecast,
  getLatestForecast,
  getStockAnalyticsOverview,
} from "./analyticsApi";

export function useStockAnalyticsOverviewQuery(pharmacyId?: number) {
  return useQuery({
    queryKey: ["analytics", "stock-overview", pharmacyId ?? null],
    queryFn: () => getStockAnalyticsOverview(pharmacyId),
  });
}

export function useLatestForecastQuery(pharmacyId?: number) {
  return useQuery({
    queryKey: ["analytics", "forecast-latest", pharmacyId ?? null],
    queryFn: () => getLatestForecast(pharmacyId as number),
    enabled: pharmacyId !== undefined,
  });
}

export function useGenerateForecast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateForecast,
    onSuccess: (forecast) => {
      void queryClient.invalidateQueries({
        queryKey: ["analytics", "forecast-latest", forecast.pharmacy],
      });
      void queryClient.invalidateQueries({
        queryKey: ["analytics", "stock-overview", forecast.pharmacy],
      });
    },
  });
}
