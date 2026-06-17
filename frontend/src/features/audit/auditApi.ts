import { requestJson } from "../../lib/apiClient";

export interface AuditEvent {
  id: number;
  action: string;
  actor_email: string;
  actor_role: string;
  group: number | null;
  pharmacy: number | null;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ListAuditEventsParams {
  page: number;
  action?: string;
}

export async function listAuditEvents({
  page,
  action,
}: ListAuditEventsParams): Promise<Paginated<AuditEvent>> {
  const query = new URLSearchParams({ page: String(page) });

  if (action) {
    query.set("action", action);
  }

  return requestJson<Paginated<AuditEvent>>(`/api/audit/?${query.toString()}`);
}
