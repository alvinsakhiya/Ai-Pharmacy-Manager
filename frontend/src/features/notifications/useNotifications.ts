import { useQuery } from "@tanstack/react-query";

import { getAlerts } from "./notificationsApi";

export function useAlertsQuery() {
  return useQuery({
    queryKey: ["notifications", "alerts"],
    queryFn: getAlerts,
  });
}
