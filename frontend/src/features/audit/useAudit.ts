import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { listAuditEvents } from "./auditApi";

interface UseAuditEventsQueryParams {
  page: number;
  action: string;
}

export function useAuditEventsQuery({
  page,
  action,
}: UseAuditEventsQueryParams) {
  return useQuery({
    queryKey: ["audit", { page, action }],
    queryFn: () => listAuditEvents({ page, action }),
    placeholderData: keepPreviousData,
  });
}
