import type { ReactNode } from "react";
import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  Clock3,
  Fingerprint,
  Filter,
  KeyRound,
  MapPin,
  ScrollText,
  ShieldCheck,
  UserCog,
} from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { AUDIT_ACTION_OPTIONS } from "./auditActions";
import type { AuditEvent } from "./auditApi";
import { useAuditEventsQuery } from "./useAudit";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { labelClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";

const ACTION_LABELS = new Map<string, string>(
  AUDIT_ACTION_OPTIONS.map((option) => [option.value, option.label]),
);

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function humanizeValue(value: string): string {
  const cleaned = value.replace(/_/g, " ").trim().toLowerCase();
  if (!cleaned) return "Not recorded";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function actionLabel(action: string): string {
  return ACTION_LABELS.get(action) ?? humanizeValue(action);
}

function actionTone(action: string): BadgeVariant {
  if (action.includes("FAILED") || action.includes("DELETED")) return "danger";
  if (action.includes("PASSWORD") || action.includes("ROLE")) return "warning";
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return "info";
  if (action.includes("CREATED")) return "success";
  if (action.includes("UPDATED") || action.includes("RESET")) return "brand";
  return "neutral";
}

function actionIcon(action: string): ReactNode {
  if (action.includes("PASSWORD") || action.includes("LOGIN")) {
    return <KeyRound className="h-4 w-4" />;
  }
  if (action.includes("USER") || action.includes("ROLE")) {
    return <UserCog className="h-4 w-4" />;
  }
  if (action.includes("GROUP") || action.includes("PHARMACY")) {
    return <Building2 className="h-4 w-4" />;
  }
  return <Fingerprint className="h-4 w-4" />;
}

function formatTarget(event: AuditEvent): string {
  if (!event.target_type || !event.target_id) {
    return "No target recorded";
  }

  return `${humanizeValue(event.target_type)} #${event.target_id}`;
}

function formatScope(event: AuditEvent): string {
  const parts = [
    event.group ? `Group ${event.group}` : null,
    event.pharmacy ? `Pharmacy ${event.pharmacy}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Global or not recorded";
}

function hasMetadata(event: AuditEvent): boolean {
  return Object.keys(event.metadata ?? {}).length > 0;
}

function metadataNote(event: AuditEvent): string {
  return hasMetadata(event)
    ? "Metadata retained for audit record."
    : "No additional metadata recorded.";
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : pluralLabel}`;
}

function SummaryCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  icon: ReactNode;
}) {
  return (
    <article className="interactive-card flex min-h-[118px] flex-col justify-between rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-subtle text-ink-soft"
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="tnum text-2xl font-extrabold tracking-[-0.02em] text-ink">
          {value}
        </p>
        <p className="mt-2 text-xs font-medium leading-relaxed text-muted">
          {note}
        </p>
      </div>
    </article>
  );
}

function AuditEventCard({ event, isLast }: { event: AuditEvent; isLast: boolean }) {
  const label = actionLabel(event.action);
  const tone = actionTone(event.action);

  return (
    <li className="relative grid gap-3 pl-12">
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-5 top-10 bottom-[-1.25rem] w-px bg-line",
          isLast && "hidden",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-2 grid h-10 w-10 place-items-center rounded-full border bg-surface shadow-elev-1",
          tone === "danger"
            ? "border-danger-border text-danger"
            : tone === "warning"
              ? "border-warning-border text-warning"
              : tone === "success"
                ? "border-success-border text-success"
                : "border-line-strong text-ink-soft",
        )}
      >
        {actionIcon(event.action)}
      </span>

      <article className="rounded-2xl border border-line bg-surface p-4 shadow-soft transition-colors duration-200 ease-soft hover:border-line-strong">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold tracking-[-0.01em] text-ink">
                {label}
              </h2>
              <Badge variant={tone}>{event.action}</Badge>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
              <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="tnum">{formatDateTime(event.created_at)}</span>
            </p>
          </div>
          {event.actor_role ? (
            <Badge variant="neutral">{event.actor_role}</Badge>
          ) : null}
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Actor
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-ink">
              {event.actor_email || "System"}
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Target
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-ink">
              {formatTarget(event)}
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Scope
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-ink">
              {formatScope(event)}
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Network
            </dt>
            <dd className="mt-1 break-words text-sm font-semibold text-ink">
              {event.ip_address || "Not recorded"}
            </dd>
          </div>
        </dl>

        <p className="mt-3 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-[13px] font-medium text-ink-soft">
          {metadataNote(event)}
        </p>
      </article>
    </li>
  );
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
  const mostRecent = results[0];
  const selectedActionLabel = action ? actionLabel(action) : "All actions";
  const isSuperintendentEmpty =
    auditQuery.isSuccess && results.length === 0 && role === "SUPERINTENDENT";

  function handleActionChange(nextAction: string) {
    setAction(nextAction);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Governance"
        title="Audit Log"
        subtitle="Review operational activity across pharmacy workflows. Human review required."
      />

      <section
        aria-label="Audit summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          label="Events shown"
          value={auditQuery.isLoading ? "—" : results.length.toLocaleString()}
          note={
            auditQuery.isLoading
              ? "Loading current page"
              : `${plural(totalCount, "event")} in current query`
          }
          icon={<ScrollText className="h-4 w-4" />}
        />
        <SummaryCard
          label="Most recent event"
          value={mostRecent ? actionLabel(mostRecent.action) : "—"}
          note={mostRecent ? formatDateTime(mostRecent.created_at) : "Not available"}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <SummaryCard
          label="Selected action filter"
          value={selectedActionLabel}
          note={action ? "Filtered view" : "All supported actions"}
          icon={<Filter className="h-4 w-4" />}
        />
        <SummaryCard
          label="Current page"
          value={page}
          note={nextPage ? "More events available" : "End of current results"}
          icon={<MapPin className="h-4 w-4" />}
        />
      </section>

      <Panel>
        <PanelHeader
          title="Filter events"
          subtitle="Filter by supported action while preserving the existing audit query."
          icon={<Filter className="h-4 w-4" />}
          actions={action ? <Badge variant="brand">{selectedActionLabel}</Badge> : null}
        />
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
          <PanelHeader
            title="Audit timeline"
            subtitle="Loading operational activity."
            icon={<ShieldCheck className="h-4 w-4" />}
          />
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
          title="No audit events match the current filter."
          description={
            isSuperintendentEmpty
              ? "Group-level audit visibility is limited in this phase."
              : "Events appear here as actions are recorded across your scope."
          }
        />
      ) : null}

      {auditQuery.isSuccess && results.length > 0 ? (
        <section className="space-y-4">
          <Panel>
            <PanelHeader
              title="Audit timeline"
              subtitle="Append-only activity shown from the existing audit API."
              icon={<ShieldCheck className="h-4 w-4" />}
              actions={<Badge variant="neutral">{plural(results.length, "event")}</Badge>}
            />
            <PanelBody>
              <ol className="space-y-5">
                {results.map((event, index) => (
                  <AuditEventCard
                    event={event}
                    isLast={index === results.length - 1}
                    key={event.id}
                  />
                ))}
              </ol>
            </PanelBody>
          </Panel>

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
