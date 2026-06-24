import { useState } from "react";
import { AlertTriangle, ScrollText } from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { AUDIT_ACTION_OPTIONS } from "./auditActions";
import type { AuditEvent } from "./auditApi";
import { useAuditEventsQuery } from "./useAudit";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel, PanelBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  TableScroll,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "../../components/ui/Table";
import { labelClass, selectClass } from "../../components/ui/forms";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTarget(event: AuditEvent): string {
  if (!event.target_type || !event.target_id) {
    return "—";
  }

  return `${event.target_type} #${event.target_id}`;
}

function formatMetadata(metadata: Record<string, unknown>): string {
  const serialized = JSON.stringify(metadata);
  return serialized.length > 90 ? `${serialized.slice(0, 87)}...` : serialized;
}

export function AuditScreen() {
  const { role } = usePermissions();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const auditQuery = useAuditEventsQuery({ page, action });

  const data = auditQuery.data;
  const results = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const previousPage = data?.previous ?? null;
  const nextPage = data?.next ?? null;
  const isSuperintendentEmpty =
    auditQuery.isSuccess && results.length === 0 && role === "SUPERINTENDENT";

  function handleActionChange(nextAction: string) {
    setAction(nextAction);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System"
        title="Audit Log"
        subtitle="Review read-only audit events in your permitted scope. Backend tenancy rules remain the source of truth for visibility."
      />

      <Panel>
        <PanelBody>
          <label className={labelClass} htmlFor="audit-action-filter">
            Action
          </label>
          <select
            className={`${selectClass} sm:max-w-xs`}
            id="audit-action-filter"
            onChange={(event) => handleActionChange(event.target.value)}
            value={action}
          >
            <option value="">All actions</option>
            {AUDIT_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </PanelBody>
      </Panel>

      {auditQuery.isLoading ? (
        <Panel>
          <PanelBody>
            <SkeletonRows rows={8} />
          </PanelBody>
        </Panel>
      ) : null}

      {auditQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Could not load audit events."
          description="Please retry. If this continues, your session or permissions may need refreshing."
          action={
            <Button variant="danger" onClick={() => void auditQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {auditQuery.isSuccess && results.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title={
            isSuperintendentEmpty
              ? "Group-level audit visibility is limited in this phase."
              : "No audit events."
          }
          description="Events appear here as actions are recorded across your scope."
        />
      ) : null}

      {auditQuery.isSuccess && results.length > 0 ? (
        <section className="space-y-4">
          <TableScroll>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>When</TH>
                  <TH>Action</TH>
                  <TH>Actor</TH>
                  <TH>Role</TH>
                  <TH>Target</TH>
                  <TH>IP</TH>
                  <TH>Details</TH>
                </TR>
              </THead>
              <TBody>
                {results.map((event) => (
                  <TR key={event.id}>
                    <TD className="tnum whitespace-nowrap text-muted">
                      {formatDateTime(event.created_at)}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <span className="font-semibold text-ink">
                        {event.action}
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap">
                      {event.actor_email || "—"}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {event.actor_role ? (
                        <Badge variant="neutral">{event.actor_role}</Badge>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="whitespace-nowrap">{formatTarget(event)}</TD>
                    <TD className="tnum whitespace-nowrap text-muted">
                      {event.ip_address ?? "—"}
                    </TD>
                    <TD className="max-w-xs truncate font-mono text-xs text-muted">
                      {formatMetadata(event.metadata)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>

          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-muted shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <p className="tnum">
              Showing {results.length} of {totalCount}
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                disabled={previousPage === null || page === 1}
                onClick={() =>
                  setPage((currentPage) => Math.max(1, currentPage - 1))
                }
              >
                Prev
              </Button>
              <span className="tnum font-semibold text-ink-soft">
                Page {page}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={nextPage === null}
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
