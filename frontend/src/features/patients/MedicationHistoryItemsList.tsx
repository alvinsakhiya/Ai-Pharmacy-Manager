import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock3, Pill, Search } from "lucide-react";

import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { inputClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import type {
  DosetteCycle,
  PatientMedicationLine,
} from "../dosette/dosetteApi";

const NOT_RECORDED = "Not recorded";

const TIME_SLOTS = [
  { key: "quantity_morning", label: "Morning" },
  { key: "quantity_lunchtime", label: "Lunchtime" },
  { key: "quantity_evening", label: "Evening" },
  { key: "quantity_bedtime", label: "Bedtime" },
] as const;

type StatusFilter = "all" | "active" | "discontinued";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All medications" },
  { value: "active", label: "Active only" },
  { value: "discontinued", label: "Discontinued only" },
];

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return NOT_RECORDED;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return NOT_RECORDED;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTimingValue(
  value: string | null | undefined,
  actor?: string | null,
): string {
  if (!value) {
    return NOT_RECORDED;
  }

  const formatted = formatDateTime(value);
  const trimmedActor = actor?.trim();
  return trimmedActor ? `${formatted} by ${trimmedActor}` : formatted;
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function medicationDescriptor(line: PatientMedicationLine): string {
  const parts = [
    line.strength?.trim(),
    line.form ? formatLabel(line.form) : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : "Strength/form not recorded";
}

function dosageInstructions(line: PatientMedicationLine): string {
  return line.dose_instructions.trim() || "Dosage instructions not recorded.";
}

function appearanceLabel(line: PatientMedicationLine): string {
  const parts = [line.colour?.trim(), line.shape?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : NOT_RECORDED;
}

function cycleBadgeVariant(status: string): BadgeVariant {
  if (["CHECKED", "COLLECTED", "DELIVERED", "COMPLETED"].includes(status)) {
    return "success";
  }
  if (status === "PREPARED") {
    return "info";
  }
  if (status === "NEEDS_CHANGES") {
    return "warning";
  }
  if (status === "CANCELLED") {
    return "danger";
  }
  return "neutral";
}

// --- Dosette event helpers (real event timestamps only; never planned/draft) ---
function cycleEventDate(cycle: DosetteCycle): string | null {
  return cycle.deducted_at ?? cycle.checked_at ?? cycle.prepared_at;
}

function cycleEventType(cycle: DosetteCycle): string {
  if (cycle.deducted_at) {
    return "Stock deducted";
  }
  if (cycle.checked_at) {
    return "Checked";
  }
  if (cycle.prepared_at) {
    return "Prepared";
  }
  return NOT_RECORDED;
}

function sortTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function latestByDate(
  cycles: DosetteCycle[],
  dateFor: (cycle: DosetteCycle) => string | null | undefined,
): DosetteCycle | null {
  return (
    cycles
      .map((cycle) => ({ cycle, timestamp: sortTimestamp(dateFor(cycle)) }))
      .filter((item) => item.timestamp > Number.NEGATIVE_INFINITY)
      .sort((left, right) => right.timestamp - left.timestamp)[0]?.cycle ?? null
  );
}

/** Most recent cycle that has actually been prepared/checked/deducted. */
function latestDispensedCycle(cycles: DosetteCycle[]): DosetteCycle | null {
  return latestByDate(cycles, cycleEventDate);
}

/** Most recent cycle overall for reference context, using real record timestamps. */
function latestCycle(cycles: DosetteCycle[]): DosetteCycle | null {
  return latestByDate(
    cycles,
    (cycle) => cycleEventDate(cycle) ?? cycle.created_at,
  );
}

function DoseSlots({ line }: { line: PatientMedicationLine }) {
  return (
    <div className="flex flex-wrap gap-1">
      {TIME_SLOTS.map((slot) => {
        const dosed = line[slot.key] > 0;
        return (
          <span
            className={cn(
              "tnum inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
              dosed
                ? "border-line-strong bg-surface text-ink"
                : "border-line bg-surface-subtle text-muted",
            )}
            key={slot.key}
          >
            {slot.label} {line[slot.key]}
          </span>
        );
      })}
    </div>
  );
}

function DailyDoseGrid({ line }: { line: PatientMedicationLine }) {
  return (
    <div aria-label="Daily dose" className="grid gap-1.5 sm:grid-cols-4">
      {TIME_SLOTS.map((slot) => {
        const value = line[slot.key];
        return (
          <div
            className={cn(
              "min-w-0 rounded-lg border px-2 py-1.5",
              value > 0
                ? "border-lilac bg-lilac-soft"
                : "border-line bg-surface-subtle",
            )}
            key={slot.key}
          >
            <p className="break-words text-[10px] font-semibold text-muted">
              {slot.label}
            </p>
            <p className="tnum mt-0.5 text-base font-extrabold leading-none text-ink">
              {value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-subtle px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-muted">
        {label}
      </p>
      <p className="tnum mt-0.5 break-words text-base font-extrabold leading-tight text-ink">
        {value}
      </p>
    </div>
  );
}

function CompactInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-subtle px-2.5 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.02em] text-muted">
        {label}
      </dt>
      <dd className="tnum mt-0.5 min-w-0 break-words text-xs font-bold leading-snug text-ink-soft">
        {value}
      </dd>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
      <span className="text-[11px] font-semibold text-muted">
        {label}
      </span>
      <span className="tnum min-w-0 break-words text-[11px] font-bold text-ink-soft">
        {value}
      </span>
    </div>
  );
}

function TimingSummary({
  preparedCycle,
  checkedCycle,
  deductedCycle,
}: {
  preparedCycle: DosetteCycle | null;
  checkedCycle: DosetteCycle | null;
  deductedCycle: DosetteCycle | null;
}) {
  const items = [
    {
      label: "Prepared",
      value: formatDateTime(preparedCycle?.prepared_at),
    },
    {
      label: "Checked",
      value: formatDateTime(checkedCycle?.checked_at),
    },
    {
      label: "Deducted",
      value: formatDateTime(deductedCycle?.deducted_at),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Compact timing summary">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-soft"
        >
          <span className="text-muted">{item.label}</span>
          <span className="tnum min-w-0 break-words">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function MedicationCard({
  line,
  isSelected,
  eventDate,
  eventType,
  latest,
  preparedCycle,
  checkedCycle,
  deductedCycle,
  onSelect,
}: {
  line: PatientMedicationLine;
  isSelected: boolean;
  eventDate: string | null;
  eventType: string;
  latest: DosetteCycle | null;
  preparedCycle: DosetteCycle | null;
  checkedCycle: DosetteCycle | null;
  deductedCycle: DosetteCycle | null;
  onSelect: (id: number) => void;
}) {
  const statusVariant: BadgeVariant = line.is_active ? "success" : "neutral";
  const hasDeductedStock = deductedCycle !== null;

  return (
    <button
      aria-selected={isSelected}
      className={cn(
        "block w-full rounded-xl border p-3 text-left shadow-elev-1 transition-all duration-150 ease-soft focus-ring",
        isSelected
          ? "border-lilac bg-lilac-soft shadow-elev-2"
          : "border-line bg-surface hover:-translate-y-px hover:border-line-strong hover:shadow-elev-2",
      )}
      onClick={() => onSelect(line.id)}
      role="option"
      type="button"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0 break-words text-sm font-extrabold tracking-[-0.01em] text-ink">
              {line.medication_name}
            </span>
            <Badge dot variant={statusVariant}>
              {line.is_active ? "Active" : "Discontinued"}
            </Badge>
            <Badge dot variant={hasDeductedStock ? "success" : "neutral"}>
              {hasDeductedStock ? "Stock deducted" : "Stock not deducted"}
            </Badge>
          </div>
          <p className="mt-0.5 break-words text-xs font-semibold text-muted">
            {medicationDescriptor(line)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge variant={eventDate ? "info" : "neutral"}>{eventType}</Badge>
          {latest ? (
            <Badge variant={cycleBadgeVariant(latest.status)}>
              {formatLabel(latest.status)}
            </Badge>
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              "grid h-7 w-7 place-items-center rounded-lg border transition-colors duration-150 ease-soft",
              isSelected
                ? "border-lilac bg-surface text-brand"
                : "border-line bg-surface-subtle text-muted",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="mt-2.5 space-y-2">
        <DoseSlots line={line} />
        <p className="text-xs leading-relaxed text-ink-soft">
          {dosageInstructions(line)}
        </p>
      </div>

      <div className="mt-3 grid gap-x-3 gap-y-1.5 border-t border-line pt-2 md:grid-cols-2">
        <MetaItem label="Latest event" value={formatDateTime(eventDate)} />
        <MetaItem
          label="Latest cycle"
          value={
            latest
              ? `${latest.reference} - ${formatLabel(latest.status)}`
              : NOT_RECORDED
          }
        />
        <MetaItem label="Appearance" value={appearanceLabel(line)} />
        <MetaItem label="Start date" value={formatDate(line.start_date)} />
      </div>

      <div className="mt-2">
        <TimingSummary
          checkedCycle={checkedCycle}
          deductedCycle={deductedCycle}
          preparedCycle={preparedCycle}
        />
      </div>
    </button>
  );
}

function SelectedMedicationPanel({
  line,
  eventDate,
  eventType,
  latest,
  preparedCycle,
  checkedCycle,
  deductedCycle,
}: {
  line: PatientMedicationLine;
  eventDate: string | null;
  eventType: string;
  latest: DosetteCycle | null;
  preparedCycle: DosetteCycle | null;
  checkedCycle: DosetteCycle | null;
  deductedCycle: DosetteCycle | null;
}) {
  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Latest event",
      value: eventDate
        ? `${eventType} · ${formatDateTime(eventDate)}`
        : NOT_RECORDED,
    },
    {
      label: "Latest cycle",
      value: latest
        ? `${latest.reference} · ${formatLabel(latest.status)}`
        : NOT_RECORDED,
    },
    { label: "Appearance", value: appearanceLabel(line) },
    { label: "Start date", value: formatDate(line.start_date) },
  ];
  const cycleRows: Array<{ label: string; value: string }> = [
    {
      label: "Cycle reference",
      value: latest?.reference ?? NOT_RECORDED,
    },
    {
      label: "Cycle status",
      value: latest ? formatLabel(latest.status) : NOT_RECORDED,
    },
    {
      label: "Prepared at",
      value: formatTimingValue(latest?.prepared_at, latest?.prepared_by_email),
    },
    {
      label: "Checked at",
      value: formatTimingValue(latest?.checked_at, latest?.checked_by_email),
    },
    {
      label: "Stock deducted at",
      value: formatTimingValue(latest?.deducted_at),
    },
  ];
  const eventRows: Array<{ label: string; value: string }> = [
    {
      label: "Prepared",
      value: formatTimingValue(
        preparedCycle?.prepared_at,
        preparedCycle?.prepared_by_email,
      ),
    },
    {
      label: "Checked",
      value: formatTimingValue(
        checkedCycle?.checked_at,
        checkedCycle?.checked_by_email,
      ),
    },
    {
      label: "Stock deducted",
      value: formatTimingValue(deductedCycle?.deducted_at),
    },
    {
      label: "Recorded",
      value: formatTimingValue(line.created_at),
    },
  ];

  return (
    <aside
      aria-label="Selected medication"
      className="h-fit rounded-xl border border-line bg-surface p-3 shadow-soft xl:sticky xl:top-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.02em] text-muted">
        Selected medication
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 break-words text-base font-extrabold tracking-[-0.01em] text-ink">
          {line.medication_name}
        </h4>
        <Badge dot variant={line.is_active ? "success" : "neutral"}>
          {line.is_active ? "Active" : "Discontinued"}
        </Badge>
      </div>
      <p className="mt-0.5 break-words text-xs font-semibold text-muted">
        {medicationDescriptor(line)}
      </p>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-bold text-ink">Daily dose</p>
        <DailyDoseGrid line={line} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        {dosageInstructions(line)}
      </p>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <CompactInfoItem key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>

      <div className="mt-3">
        <h5 className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Clock3 aria-hidden="true" className="h-4 w-4 text-brand" />
          Latest event timing
        </h5>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {eventRows.map((row) => (
            <CompactInfoItem key={row.label} label={row.label} value={row.value} />
          ))}
        </dl>
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <dt className="sm:col-span-2 text-xs font-bold text-ink">
          Cycle context
        </dt>
        {cycleRows.map((row) => (
          <CompactInfoItem key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>
    </aside>
  );
}

interface MedicationHistoryItemsListProps {
  medicationLines: PatientMedicationLine[];
  cycles: DosetteCycle[];
}

export function MedicationHistoryItemsList({
  medicationLines,
  cycles,
}: MedicationHistoryItemsListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(
    () => medicationLines[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const dispensed = useMemo(() => latestDispensedCycle(cycles), [cycles]);
  const latest = useMemo(() => latestCycle(cycles), [cycles]);
  const latestPrepared = useMemo(
    () => latestByDate(cycles, (cycle) => cycle.prepared_at),
    [cycles],
  );
  const latestChecked = useMemo(
    () => latestByDate(cycles, (cycle) => cycle.checked_at),
    [cycles],
  );
  const latestDeducted = useMemo(
    () => latestByDate(cycles, (cycle) => cycle.deducted_at),
    [cycles],
  );
  const eventDate = dispensed ? cycleEventDate(dispensed) : null;
  const eventType = dispensed ? cycleEventType(dispensed) : NOT_RECORDED;

  const activeCount = useMemo(
    () => medicationLines.filter((line) => line.is_active).length,
    [medicationLines],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return medicationLines.filter((line) => {
      if (statusFilter === "active" && !line.is_active) {
        return false;
      }
      if (statusFilter === "discontinued" && line.is_active) {
        return false;
      }
      if (query) {
        const haystack = [
          line.medication_name,
          line.dose_instructions,
          line.strength ?? "",
          line.form ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [medicationLines, search, statusFilter]);

  useEffect(() => {
    if (medicationLines.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!medicationLines.some((line) => line.id === selectedId)) {
      setSelectedId(medicationLines[0].id);
    }
  }, [medicationLines, selectedId]);

  const selectedLine =
    medicationLines.find((line) => line.id === selectedId) ?? null;

  return (
    <section
      aria-label="Patient medication history"
      className="space-y-3"
    >
      <div
        aria-label="Medication history summary"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
      >
        <SummaryStat label="Active medications" value={String(activeCount)} />
        <SummaryStat
          label="Latest prepared"
          value={formatDateTime(latestPrepared?.prepared_at)}
        />
        <SummaryStat
          label="Latest checked"
          value={formatDateTime(latestChecked?.checked_at)}
        />
        <SummaryStat
          label="Latest stock deducted"
          value={formatDateTime(latestDeducted?.deducted_at)}
        />
        <SummaryStat label="Dosette cycles" value={String(cycles.length)} />
      </div>

      {medicationLines.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-6 w-6" />}
          title="No medication history recorded yet."
          description="Dosette and dispensing records will appear here once prepared. Human review required."
        />
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface p-2 shadow-elev-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative flex-1">
                <span className="sr-only">Search medications</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  className={cn(inputClass, "pl-9")}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search medication name or instructions"
                  type="search"
                  value={search}
                />
              </label>
              <label className="sm:w-52">
                <span className="sr-only">Filter by status</span>
                <select
                  className={selectClass}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  value={statusFilter}
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.02fr)_minmax(460px,0.98fr)]">
            <div
              aria-label="Medication items"
              className="space-y-2.5"
              role="listbox"
            >
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-6 w-6" />}
                  title="No medications match your search or filter."
                  description="Clear the search or choose a different status filter."
                />
              ) : (
                filtered.map((line) => (
                  <MedicationCard
                    checkedCycle={latestChecked}
                    deductedCycle={latestDeducted}
                    eventDate={eventDate}
                    eventType={eventType}
                    isSelected={selectedId === line.id}
                    key={line.id}
                    latest={latest}
                    line={line}
                    onSelect={setSelectedId}
                    preparedCycle={latestPrepared}
                  />
                ))
              )}
            </div>

            {selectedLine ? (
              <SelectedMedicationPanel
                checkedCycle={latestChecked}
                deductedCycle={latestDeducted}
                eventDate={eventDate}
                eventType={eventType}
                latest={latest}
                line={selectedLine}
                preparedCycle={latestPrepared}
              />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
