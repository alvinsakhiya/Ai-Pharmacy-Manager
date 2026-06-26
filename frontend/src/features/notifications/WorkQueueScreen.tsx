import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  BellOff,
  ClipboardCheck,
  Clock3,
  Filter,
  ListChecks,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { KpiCard } from "../../components/ui/KpiCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { labelClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import type {
  WorkQueueGroup,
  WorkQueueItem,
  WorkQueuePriority,
  WorkQueueSummary,
} from "./notificationsApi";
import { useWorkQueueQuery } from "./useNotifications";
import {
  formatWorkQueueDate,
  formatWorkQueueDateTime,
  workQueueActionLabel,
  workQueuePriorityLabel,
  workQueueStatusLabel,
  workQueueTypeLabel,
} from "./workQueueDisplay";

type FilterValue = "all";

interface GroupConfig {
  key: WorkQueueGroup;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
}

const GROUPS: GroupConfig[] = [
  {
    key: "urgent",
    title: "Urgent",
    subtitle: "Overdue or active items that need attention.",
    icon: AlertTriangle,
    accent: "border-danger-border bg-danger-soft text-danger-ink",
  },
  {
    key: "due_soon",
    title: "Due soon",
    subtitle: "Items inside a suggested preparation window.",
    icon: Clock3,
    accent: "border-warning-border bg-warning-soft text-warning-ink",
  },
  {
    key: "waiting_check",
    title: "Waiting for check",
    subtitle: "Prepared cycles awaiting a second human review.",
    icon: ShieldCheck,
    accent: "border-info-border bg-info-soft text-info-ink",
  },
  {
    key: "stock_action",
    title: "Stock/action required",
    subtitle: "Stock items and checked cycles needing follow-up.",
    icon: PackageCheck,
    accent: "border-line-strong bg-surface-sunken text-ink-soft",
  },
  {
    key: "reviews",
    title: "Reviews",
    subtitle: "Pending pharmacist review records.",
    icon: ClipboardCheck,
    accent: "border-lilac-soft bg-lilac-soft text-brand",
  },
];

const SUMMARY_CARDS: Array<{
  key: keyof WorkQueueSummary;
  label: string;
  note: string;
}> = [
  { key: "total", label: "Total", note: "Open tasks" },
  { key: "urgent", label: "Urgent", note: "Needs attention" },
  { key: "due_soon", label: "Due soon", note: "Suggested window" },
  { key: "waiting_check", label: "Waiting check", note: "Human review required" },
  { key: "stock_action", label: "Stock/action", note: "Inventory follow-up" },
  { key: "reviews", label: "Reviews", note: "Pending records" },
];

const PRIORITY_BADGES: Record<WorkQueuePriority, BadgeVariant> = {
  urgent: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

function cycleRange(item: WorkQueueItem): string | null {
  if (!item.cycle_start_date && !item.cycle_end_date) {
    return null;
  }
  return `${formatWorkQueueDate(item.cycle_start_date)} - ${formatWorkQueueDate(
    item.cycle_end_date,
  )}`;
}

function uniqueTypes(items: WorkQueueItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.type))).sort((a, b) =>
    workQueueTypeLabel(a).localeCompare(workQueueTypeLabel(b)),
  );
}

function uniquePharmacies(items: WorkQueueItem[]) {
  const pharmacies = new Map<number, string>();
  for (const item of items) {
    pharmacies.set(
      item.pharmacy_id,
      item.pharmacy_name || `Pharmacy ${item.pharmacy_id}`,
    );
  }
  return Array.from(pharmacies, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  if (value === null || value === "") {
    return null;
  }

  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function WorkQueueCard({ item }: { item: WorkQueueItem }) {
  const range = cycleRange(item);

  return (
    <article className="interactive-card rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={PRIORITY_BADGES[item.priority]} dot>
              {workQueuePriorityLabel(item.priority)}
            </Badge>
            <Badge variant="neutral">{workQueueStatusLabel(item.status)}</Badge>
            <Badge variant="info">{workQueueTypeLabel(item.type)}</Badge>
          </div>
          <h2 className="mt-3 text-base font-bold text-ink">{item.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {item.reason}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Detail label="Patient ID" value={item.patient_reference} />
            <Detail
              label="Pharmacy"
              value={item.pharmacy_name || `Pharmacy ${item.pharmacy_id}`}
            />
            <Detail
              label="Due date"
              value={item.due_date ? formatWorkQueueDate(item.due_date) : null}
            />
            <Detail label="Cycle range" value={range} />
            <Detail label="Cycle ref" value={item.cycle_reference} />
          </dl>
          <p className="mt-4 inline-flex rounded-full bg-surface-sunken px-3 py-1 text-xs font-semibold text-muted">
            Review before action
          </p>
        </div>
        <Link
          to={item.action_href}
          className={cn(
            "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full",
            "border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-soft",
            "shadow-elev-1 transition-all duration-200 ease-soft hover:-translate-y-px",
            "hover:bg-surface-subtle hover:text-ink focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2",
            "focus-visible:ring-offset-canvas",
          )}
        >
          {workQueueActionLabel(item)}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function GroupSection({
  group,
  items,
}: {
  group: GroupConfig;
  items: WorkQueueItem[];
}) {
  const Icon = group.icon;

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-labelledby={`work-queue-${group.key}`}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full border shadow-elev-1",
            group.accent,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={`work-queue-${group.key}`}
            className="text-lg font-extrabold text-ink"
          >
            {group.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{group.subtitle}</p>
        </div>
        <span className="tnum rounded-full border border-line bg-surface px-3 py-1 text-sm font-bold text-ink-soft shadow-elev-1">
          {items.length}
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <WorkQueueCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

export function WorkQueueScreen() {
  const workQueueQuery = useWorkQueueQuery();
  const [priorityFilter, setPriorityFilter] = useState<
    FilterValue | WorkQueuePriority
  >("all");
  const [typeFilter, setTypeFilter] = useState<FilterValue | string>("all");
  const [pharmacyFilter, setPharmacyFilter] = useState<FilterValue | string>("all");

  const items = useMemo(
    () => workQueueQuery.data?.items ?? [],
    [workQueueQuery.data?.items],
  );
  const typeOptions = useMemo(() => uniqueTypes(items), [items]);
  const pharmacyOptions = useMemo(() => uniquePharmacies(items), [items]);
  const priorityOptions = useMemo(
    () =>
      (["urgent", "high", "medium", "low"] as WorkQueuePriority[]).filter(
        (priority) => items.some((item) => item.priority === priority),
      ),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (priorityFilter !== "all" && item.priority !== priorityFilter) {
          return false;
        }
        if (typeFilter !== "all" && item.type !== typeFilter) {
          return false;
        }
        if (
          pharmacyFilter !== "all" &&
          String(item.pharmacy_id) !== pharmacyFilter
        ) {
          return false;
        }
        return true;
      }),
    [items, pharmacyFilter, priorityFilter, typeFilter],
  );

  const groupedItems = useMemo(
    () =>
      GROUPS.map((group) => ({
        group,
        items: filteredItems.filter((item) => item.group === group.key),
      })),
    [filteredItems],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work queue"
        title="Pharmacy To-do List"
        subtitle="MDS preparation, checks, reviews, and stock items that need attention."
        meta={
          workQueueQuery.data
            ? `Generated ${formatWorkQueueDateTime(workQueueQuery.data.generated_at)}`
            : undefined
        }
        actions={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw className="h-4 w-4" />}
            disabled={workQueueQuery.isFetching}
            onClick={() => void workQueueQuery.refetch()}
          >
            Refresh
          </Button>
        }
      />

      {workQueueQuery.isLoading ? (
        <Panel>
          <PanelHeader title="Work queue" subtitle="Loading queue..." />
          <PanelBody>
            <SkeletonRows rows={5} />
          </PanelBody>
        </Panel>
      ) : null}

      {workQueueQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          title="Could not load the work queue."
          description="Please retry. Your session or permissions may need refreshing."
          action={
            <Button
              variant="danger"
              onClick={() => void workQueueQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {workQueueQuery.isSuccess ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {SUMMARY_CARDS.map((summary) => (
              <KpiCard
                key={summary.key}
                label={summary.label}
                value={workQueueQuery.data.summary[summary.key]}
                note={summary.note}
              />
            ))}
          </section>

          {workQueueQuery.data.items.length > 0 ? (
            <Panel>
              <PanelHeader
                title="Filters"
                subtitle={`${filteredItems.length} of ${workQueueQuery.data.items.length} tasks shown`}
                icon={<Filter className="h-4 w-4" aria-hidden="true" />}
              />
              <PanelBody>
                <div className="grid gap-3 md:grid-cols-3">
                  <label>
                    <span className={labelClass}>Priority</span>
                    <select
                      className={selectClass}
                      value={priorityFilter}
                      onChange={(event) =>
                        setPriorityFilter(
                          event.target.value as FilterValue | WorkQueuePriority,
                        )
                      }
                    >
                      <option value="all">All priorities</option>
                      {priorityOptions.map((priority) => (
                        <option value={priority} key={priority}>
                          {workQueuePriorityLabel(priority)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Task type</span>
                    <select
                      className={selectClass}
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                    >
                      <option value="all">All task types</option>
                      {typeOptions.map((type) => (
                        <option value={type} key={type}>
                          {workQueueTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {pharmacyOptions.length > 1 ? (
                    <label>
                      <span className={labelClass}>Pharmacy</span>
                      <select
                        className={selectClass}
                        value={pharmacyFilter}
                        onChange={(event) => setPharmacyFilter(event.target.value)}
                      >
                        <option value="all">All pharmacies</option>
                        {pharmacyOptions.map((pharmacy) => (
                          <option value={pharmacy.id} key={pharmacy.id}>
                            {pharmacy.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </PanelBody>
            </Panel>
          ) : null}

          {workQueueQuery.data.items.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-5 w-5" aria-hidden="true" />}
              title="Nothing needs attention right now."
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
              title="No tasks match these filters."
              description="Adjust the filters or refresh the queue."
            />
          ) : (
            <div className="space-y-8">
              {groupedItems.map(({ group, items: groupItems }) => (
                <GroupSection
                  group={group}
                  items={groupItems}
                  key={group.key}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
