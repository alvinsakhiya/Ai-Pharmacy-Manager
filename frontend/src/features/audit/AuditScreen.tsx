import type { ReactNode } from "react";
import { useMemo, useState } from "react";
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
const EMPTY_AUDIT_EVENTS: AuditEvent[] = [];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysBetween(left: Date, right: Date): number {
  const milliseconds = startOfDay(left).getTime() - startOfDay(right).getTime();
  return Math.round(milliseconds / 86_400_000);
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

function isHighImportanceAction(action: string): boolean {
  return actionTone(action) === "danger" || actionTone(action) === "warning";
}

function auditGroupLabel(event: AuditEvent, today = new Date()) {
  const eventDate = new Date(event.created_at);
  const age = daysBetween(today, eventDate);
  if (age === 0) {
    return "Today";
  }
  if (age === 1) {
    return "Yesterday";
  }
  return "Earlier";
}

function auditGroupId(label: string) {
  return `audit-group-${label.toLowerCase().replaceAll(" ", "-")}`;
}

function groupAuditEvents(events: AuditEvent[], today = new Date()) {
  const groups = [
    { label: "Today", events: [] as AuditEvent[] },
    { label: "Yesterday", events: [] as AuditEvent[] },
    { label: "Earlier", events: [] as AuditEvent[] },
  ];

  for (const event of events) {
    const label = auditGroupLabel(event, today);
    groups.find((group) => group.label === label)?.events.push(event);
  }

  return groups.filter((group) => group.events.length > 0);
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

function AuditEventCard({ event }: { event: AuditEvent }) {
  const label = actionLabel(event.action);
  const tone = actionTone(event.action);

  return (
    <article className="rounded-2xl border border-line bg-surface p-3.5 shadow-soft transition-colors duration-200 ease-soft hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-surface shadow-elev-1",
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
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
                  {label}
                </h3>
                <Badge variant={tone}>{event.action}</Badge>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="tnum">{formatDateTime(event.created_at)}</span>
              </p>
            </div>
            {event.actor_role ? (
              <Badge variant="neutral">{event.actor_role}</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Actor
          </dt>
          <dd className="mt-1 break-words text-sm font-semibold text-ink">
            {event.actor_email || "System"}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Target
          </dt>
          <dd className="mt-1 break-words text-sm font-semibold text-ink">
            {formatTarget(event)}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Scope
          </dt>
          <dd className="mt-1 break-words text-sm font-semibold text-ink">
            {formatScope(event)}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Network
          </dt>
          <dd className="mt-1 break-words text-sm font-semibold text-ink">
            {event.ip_address || "Not recorded"}
          </dd>
        </div>
      </dl>

      <p className="mt-2.5 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-[13px] font-medium text-ink-soft">
        {metadataNote(event)}
      </p>
    </article>
  );
}

function AuditGroupSection({
  events,
  label,
}: {
  events: AuditEvent[];
  label: string;
}) {
  const groupId = auditGroupId(label);

  return (
    <section
      aria-labelledby={groupId}
      className="rounded-2xl border border-line bg-surface-subtle p-3.5 shadow-soft sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id={groupId}
            className="text-base font-extrabold text-ink"
          >
            {label}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Audit trail events recorded in this period.
          </p>
        </div>
        <Badge variant="neutral">{plural(events.length, "event")}</Badge>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {events.map((event) => (
          <AuditEventCard event={event} key={event.id} />
        ))}
      </div>
    </section>
  );
}

export function AuditScreen() {
  const { role } = usePermissions();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const auditQuery = useAuditEventsQuery({ page, action });

  const data = auditQuery.data;
  const results = data?.results ?? EMPTY_AUDIT_EVENTS;
  const totalCount = data?.count ?? 0;
  const previousPage = data?.previous ?? null;
  const nextPage = data?.next ?? null;
  const selectedActionLabel = action ? actionLabel(action) : "All actions";
  const today = useMemo(() => new Date(), []);
  const auditGroups = useMemo(() => groupAuditEvents(results, today), [results, today]);
  const auditSummary = useMemo(() => {
    return results.reduce(
      (summary, event) => {
        const eventAge = daysBetween(today, new Date(event.created_at));
        return {
          today: summary.today + (eventAge === 0 ? 1 : 0),
          thisWeek:
            summary.thisWeek + (eventAge >= 0 && eventAge < 7 ? 1 : 0),
          highImportance:
            summary.highImportance + (isHighImportanceAction(event.action) ? 1 : 0),
          userActions: summary.userActions + (event.actor_email ? 1 : 0),
          systemActions: summary.systemActions + (event.actor_email ? 0 : 1),
        };
      },
      {
        today: 0,
        thisWeek: 0,
        highImportance: 0,
        userActions: 0,
        systemActions: 0,
      },
    );
  }, [results, today]);
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
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <SummaryCard
          label="Today"
          value={auditQuery.isLoading ? "—" : auditSummary.today.toLocaleString()}
          note={
            auditQuery.isLoading
              ? "Loading current page"
              : "Events dated today on this page"
          }
          icon={<ScrollText className="h-4 w-4" />}
        />
        <SummaryCard
          label="This week"
          value={
            auditQuery.isLoading ? "—" : auditSummary.thisWeek.toLocaleString()
          }
          note={
            auditQuery.isLoading
              ? "Loading current page"
              : `${plural(totalCount, "event")} in current query`
          }
          icon={<Clock3 className="h-4 w-4" />}
        />
        <SummaryCard
          label="High importance"
          value={
            auditQuery.isLoading
              ? "—"
              : auditSummary.highImportance.toLocaleString()
          }
          note="Failed, deleted, password, or role events"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <SummaryCard
          label="User actions"
          value={
            auditQuery.isLoading ? "—" : auditSummary.userActions.toLocaleString()
          }
          note={action ? `Filtered to ${selectedActionLabel}` : "Recorded actor events"}
          icon={<Filter className="h-4 w-4" />}
        />
        <SummaryCard
          label="System actions"
          value={
            auditQuery.isLoading
              ? "—"
              : auditSummary.systemActions.toLocaleString()
          }
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
            title="Audit trail"
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
              title="Audit trail"
              subtitle="Grouped append-only activity shown from the existing audit API."
              icon={<ShieldCheck className="h-4 w-4" />}
              actions={<Badge variant="neutral">{plural(results.length, "event")}</Badge>}
            />
            <PanelBody className="space-y-4">
              {auditGroups.map((group) => (
                <AuditGroupSection
                  events={group.events}
                  key={group.label}
                  label={group.label}
                />
              ))}
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
