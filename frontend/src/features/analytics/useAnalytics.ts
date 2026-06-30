import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  dismissTransferSuggestion,
  generateForecast,
  generateTransferSuggestions,
  getExpiryRisk,
  getLatestForecast,
  getMdsDemandSignal,
  getStockAnalyticsOverview,
  getStockReviewQueue,
  listTransferSuggestions,
} from "./analyticsApi";

export function useStockAnalyticsOverviewQuery(pharmacyId?: number) {
  return useQuery({
    queryKey: ["analytics", "stock-overview", pharmacyId ?? null],
    queryFn: () => getStockAnalyticsOverview(pharmacyId),
  });
}

export function useMdsDemandSignalQuery(pharmacyId?: number, horizonDays = 28) {
  return useQuery({
    queryKey: ["analytics", "mds-demand", pharmacyId ?? null, horizonDays],
    queryFn: () => getMdsDemandSignal(pharmacyId, horizonDays),
  });
}

export function useExpiryRiskQuery(pharmacyId?: number) {
  return useQuery({
    queryKey: ["analytics", "expiry-risk", pharmacyId ?? null],
    queryFn: () => getExpiryRisk(pharmacyId),
  });
}

export function useStockReviewQueueQuery(pharmacyId?: number, horizonDays = 28) {
  return useQuery({
    queryKey: ["analytics", "stock-review-queue", pharmacyId ?? null, horizonDays],
    queryFn: () => getStockReviewQueue(pharmacyId, horizonDays),
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

export function useTransferSuggestionsQuery(
  groupId?: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ["analytics", "transfer-suggestions", groupId ?? null],
    queryFn: () => listTransferSuggestions(groupId as number),
    enabled: enabled && groupId !== undefined,
  });
}

export function useGenerateTransferSuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateTransferSuggestions,
    onSuccess: (_suggestions, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["analytics", "transfer-suggestions", variables.group],
      });
    },
  });
}

export function useDismissTransferSuggestion(groupId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissTransferSuggestion,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["analytics", "transfer-suggestions", groupId ?? null],
      });
    },
  });
}
