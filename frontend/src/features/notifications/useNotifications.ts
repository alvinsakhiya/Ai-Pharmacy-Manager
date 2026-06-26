import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  clearAlerts,
  dismissAlert,
  getAlerts,
  getWorkQueue,
} from "./notificationsApi";

export function useAlertsQuery() {
  return useQuery({
    queryKey: ["notifications", "alerts"],
    queryFn: getAlerts,
  });
}

export function useWorkQueueQuery() {
  return useQuery({
    queryKey: ["notifications", "work-queue"],
    queryFn: getWorkQueue,
  });
}

export function useDismissAlertMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissAlert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "alerts"] });
    },
  });
}

export function useClearAlertsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearAlerts,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "alerts"] });
    },
  });
}
