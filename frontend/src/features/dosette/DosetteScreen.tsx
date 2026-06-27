import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Grid3x3,
  Moon,
  PackageCheck,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui/Table";
import { useToast } from "../../components/ui/Toast";
import { StatusTrack, type TrackStep } from "../../components/ui/StatusTrack";
import { inputClass, labelClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import { ApiError } from "../../lib/apiClient";
import { DosetteCycleFormModal } from "./DosetteCycleFormModal";
import { PatientMedicationFormModal } from "./PatientMedicationFormModal";
import type {
  DosetteCycle,
  PatientMedicationLine,
  PickingList,
  PickingListRow,
  StockPreview,
  StockPreviewRow,
} from "./dosetteApi";
import type { CycleStatusTransition } from "./dosetteApi";
import {
  useCancelDosetteCycle,
  useDeductDosetteStock,
  useDiscontinuePatientMedication,
  useDosetteCyclesQuery,
  usePatientMedicationsQuery,
  usePickingListQuery,
  usePrepareDosetteCycle,
  useStockPreviewQuery,
  useUpdateCycleStatus,
  useUpdateMedicationAppearance,
} from "./useDosette";

function formatDate(value: string): string {
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

function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function safeText(value: string | null | undefined): string {
  return value?.trim() ? value : "Not recorded";
}

function optionalDate(value: string | null | undefined): string {
  return value ? formatDate(value) : "Not recorded";
}

function optionalDateTime(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "Not recorded";
}

interface StrengthFormInfo {
  strength?: string | null;
  form?: string | null;
}

interface AppearanceInfo {
  colour?: string | null;
  shape?: string | null;
}

function strengthFormLabel(item: StrengthFormInfo): string {
  const strength = safeText(item.strength);
  const form = safeText(item.form);
  if (strength === "Not recorded" && form === "Not recorded") {
    return "Not recorded";
  }

  return `${strength} / ${form}`;
}

function appearanceLabel(item: AppearanceInfo): string {
  const colour = item.colour?.trim();
  const shape = item.shape?.trim();
  return [colour, shape].filter(Boolean).join(" · ") || "No appearance recorded";
}

function appearanceColour(colour: string | undefined): string {
  const normalised = colour?.trim().toLowerCase() ?? "";
  const knownColours: Record<string, string> = {
    beige: "#d8c3a5",
    black: "#1f2937",
    blue: "#93c5fd",
    brown: "#a16207",
    cream: "#fef3c7",
    green: "#86efac",
    grey: "#d1d5db",
    gray: "#d1d5db",
    orange: "#fdba74",
    pink: "#f9a8d4",
    purple: "#c4b5fd",
    red: "#fca5a5",
    white: "#f8fafc",
    yellow: "#fde68a",
  };

  return knownColours[normalised] ?? "#e5e7eb";
}

function appearanceShapeClass(shape: string | undefined): string {
  const normalised = shape?.trim().toLowerCase() ?? "";
  if (/(capsule|caplet|oval|oblong)/.test(normalised)) {
    return "h-5 w-10 rounded-full";
  }
  if (/(square|rectangle)/.test(normalised)) {
    return "h-7 w-7 rounded-md";
  }
  if (/pill/.test(normalised)) {
    return "h-6 w-9 rounded-full";
  }

  return "h-7 w-7 rounded-full";
}

function totalDaily(line: PatientMedicationLine): number {
  return (
    line.quantity_morning +
    line.quantity_lunchtime +
    line.quantity_evening +
    line.quantity_bedtime
  );
}

function statusLabel(value: boolean | string): string {
  if (typeof value === "boolean") {
    return value ? "Active" : "Inactive";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type StatusTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

function cycleStatusTone(status: string): StatusTone {
  switch (status) {
    case "DRAFT":
      return "info";
    case "NEEDS_CHANGES":
      return "warning";
    case "PREPARED":
      return "brand";
    case "CHECKED":
    case "DELIVERED":
    case "COMPLETED":
      return "success";
    case "COLLECTED":
      return "info";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

function MedicationStatusBadge({ value }: { value: boolean | string }) {
  const tone: StatusTone =
    typeof value === "boolean"
      ? value
        ? "success"
        : "neutral"
      : cycleStatusTone(value);

  return (
    <Badge dot variant={tone}>
      {statusLabel(value)}
    </Badge>
  );
}

// Pack lifecycle as a ShipMates-style route track.
const PACK_STEPS: TrackStep[] = [
  { key: "DRAFT", label: "Needs prep" },
  { key: "PREPARED", label: "Prepared" },
  { key: "CHECKED", label: "Checked" },
  { key: "COLLECTED", label: "Collected" },
  { key: "DELIVERED", label: "Delivered" },
];

const WORKFLOW_STEPS: TrackStep[] = [
  { key: "DRAFT", label: "Ready to prepare" },
  { key: "PREPARED", label: "Prepared" },
  { key: "CHECKED", label: "Checked" },
  { key: "STOCK_DEDUCTED", label: "Stock deducted" },
  { key: "COLLECTED", label: "Collected" },
  { key: "DELIVERED", label: "Delivered" },
];

function packStatusIndex(status: string): number {
  if (status === "NEEDS_CHANGES") return 0;
  if (status === "COMPLETED" || status === "DELIVERED") {
    return PACK_STEPS.length - 1;
  }
  const index = PACK_STEPS.findIndex((step) => step.key === status);
  return index < 0 ? 0 : index;
}

function cycleWorkflowIndex(cycle: DosetteCycle): number {
  if (cycle.status === "CANCELLED" || cycle.status === "NEEDS_CHANGES") {
    return 0;
  }
  if (cycle.status === "COMPLETED" || cycle.status === "DELIVERED") {
    return WORKFLOW_STEPS.length - 1;
  }
  if (cycle.status === "COLLECTED") {
    return 4;
  }
  if (cycle.stock_deducted) {
    return 3;
  }
  if (cycle.status === "CHECKED") {
    return 2;
  }
  if (cycle.status === "PREPARED") {
    return 1;
  }

  return 0;
}

function cycleWorkflowLabel(cycle: DosetteCycle): string {
  if (cycle.status === "CANCELLED" || cycle.status === "NEEDS_CHANGES") {
    return statusLabel(cycle.status);
  }
  if (cycle.stock_deducted && !["COLLECTED", "DELIVERED", "COMPLETED"].includes(cycle.status)) {
    return "Stock deducted";
  }
  if (cycle.status === "DRAFT") {
    return "Ready to prepare";
  }

  return statusLabel(cycle.status);
}

const SLOT_META = [
  { key: "quantity_morning", label: "Morning", short: "AM", Icon: Sunrise },
  { key: "quantity_lunchtime", label: "Lunchtime", short: "Lunch", Icon: Sun },
  { key: "quantity_evening", label: "Evening", short: "PM", Icon: Sunset },
  { key: "quantity_bedtime", label: "Bedtime", short: "Night", Icon: Moon },
] as const;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** A single tactile blister pocket — fills with a satisfying pop when occupied. */
function Pocket({ count }: { count: number }) {
  if (count <= 0) {
    return (
      <span
        aria-hidden="true"
        className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-line bg-surface-sunken/60"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="tnum grid h-7 w-7 animate-scale-in place-items-center rounded-full border border-brand bg-brand-soft text-[11px] font-bold text-brand-ink shadow-elev-1 ease-soft"
    >
      {count}
    </span>
  );
}

/**
 * Blister tray — the emotional centrepiece. Rows are time slots (Morning / Noon /
 * Evening / Night), columns are the seven days of the pack. Filled pockets pop in
 * so assembling a pack feels physical, like loading a real tray.
 */
function BlisterTray({ row }: { row: PickingListRow }) {
  return (
    <div className="rounded-xl border border-line bg-surface-subtle/70 p-3">
      <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] items-center gap-x-2 gap-y-1.5">
        <span aria-hidden="true" />
        {DAY_LABELS.map((day) => (
          <span
            key={day}
            aria-hidden="true"
            className="text-center text-[10px] font-bold uppercase tracking-[0.06em] text-muted"
          >
            {day}
          </span>
        ))}
        {SLOT_META.map((slot) => {
          const count = row[slot.key];
          const SlotIcon = slot.Icon;
          return (
            <div key={slot.key} className="contents">
              <span
                className="flex items-center gap-1.5 pr-1 text-[11px] font-semibold text-ink-soft"
                title={slot.label}
              >
                <SlotIcon aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                {slot.short}
              </span>
              {DAY_LABELS.map((day) => (
                <div key={`${slot.key}-${day}`} className="flex justify-center">
                  <Pocket count={count} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function canEditCycle(cycle: DosetteCycle): boolean {
  return !["CANCELLED", "COMPLETED"].includes(cycle.status);
}

function canCancelCycle(cycle: DosetteCycle): boolean {
  return ["DRAFT", "PREPARED"].includes(cycle.status) && !cycle.stock_deducted;
}

const SUPPLY_PERIOD_LABEL_BY_FREQUENCY: Record<string, string> = {
  WEEKLY: "1-week supply",
  FORTNIGHTLY: "2-week supply",
  FOUR_WEEKLY: "4-week supply",
  MONTHLY: "Monthly supply",
};

const UPCOMING_PLAN_COUNT = 3;

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addCalendarMonths(value: Date, months: number): Date {
  const next = new Date(value);
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function cycleSupplyPeriodLabel(cycle: DosetteCycle): string {
  return (
    cycle.supply_period_label ||
    SUPPLY_PERIOD_LABEL_BY_FREQUENCY[cycle.frequency] ||
    statusLabel(cycle.frequency)
  );
}

function cycleDateRange(cycle: Pick<DosetteCycle, "start_date" | "end_date">) {
  return `${formatDate(cycle.start_date)} - ${formatDate(cycle.end_date)}`;
}

function cycleFriendlyLabel(cycle: DosetteCycle): string {
  if (cycle.display_label?.trim()) {
    return cycle.display_label;
  }

  return [
    cycle.patient_reference,
    cycleSupplyPeriodLabel(cycle),
    cycleDateRange(cycle),
  ]
    .filter(Boolean)
    .join(" · ");
}

function dueStatusLabel(status: string): string {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "due_soon":
      return "Due soon";
    case "current":
      return "Current cycle";
    case "closed":
      return "Closed";
    case "upcoming":
      return "Upcoming";
    default:
      return statusLabel(status);
  }
}

function dueStatusTone(status: string): StatusTone {
  switch (status) {
    case "overdue":
      return "danger";
    case "due_soon":
      return "warning";
    case "current":
      return "brand";
    case "closed":
      return "neutral";
    case "upcoming":
      return "info";
    default:
      return "neutral";
  }
}

function daysUntilDueLabel(cycle: DosetteCycle): string {
  if (cycle.due_status === "closed") {
    return "Closed cycle";
  }
  if (cycle.due_status === "overdue") {
    const days = Math.abs(cycle.days_until_due);
    return `${days} day${days === 1 ? "" : "s"} past planned end`;
  }
  if (cycle.due_status === "current") {
    return "Within the current planned date range";
  }
  if (cycle.days_until_due === 0) {
    return "Starts today";
  }
  if (cycle.days_until_due > 0) {
    return `Starts in ${cycle.days_until_due} day${
      cycle.days_until_due === 1 ? "" : "s"
    }`;
  }

  return "Review the planned dates";
}

function cycleEndDateForFrequency(startDate: string, frequency: string): string {
  const parsedStart = parseIsoDate(startDate);
  if (!parsedStart) {
    return "";
  }

  if (frequency === "MONTHLY") {
    return toIsoDate(addDays(addCalendarMonths(parsedStart, 1), -1));
  }

  const daysByFrequency: Record<string, number> = {
    WEEKLY: 7,
    FORTNIGHTLY: 14,
    FOUR_WEEKLY: 28,
  };
  const days = daysByFrequency[frequency] ?? daysByFrequency.FOUR_WEEKLY;
  return toIsoDate(addDays(parsedStart, days - 1));
}

interface PlannedCycle {
  label: string;
  start_date: string;
  end_date: string;
  supply_period_label: string;
}

function buildUpcomingCyclePlan(cycles: DosetteCycle[]): PlannedCycle[] {
  const baseCycle = [...cycles]
    .filter((cycle) => cycle.status !== "CANCELLED")
    .sort((left, right) => {
      const byEndDate = right.end_date.localeCompare(left.end_date);
      return byEndDate || right.id - left.id;
    })[0];

  if (!baseCycle) {
    return [];
  }

  const baseEndDate = parseIsoDate(baseCycle.end_date);
  if (!baseEndDate) {
    return [];
  }

  const plan: PlannedCycle[] = [];
  let nextStart = toIsoDate(addDays(baseEndDate, 1));
  for (let index = 0; index < UPCOMING_PLAN_COUNT; index += 1) {
    const endDate = cycleEndDateForFrequency(nextStart, baseCycle.frequency);
    if (!endDate) {
      return plan;
    }

    plan.push({
      label:
        index === 0
          ? "Next cycle"
          : index === 1
            ? "Following cycle"
            : `Future cycle ${index + 1}`,
      start_date: nextStart,
      end_date: endDate,
      supply_period_label: cycleSupplyPeriodLabel(baseCycle),
    });
    const parsedEndDate = parseIsoDate(endDate);
    if (!parsedEndDate) {
      return plan;
    }
    nextStart = toIsoDate(addDays(parsedEndDate, 1));
  }

  return plan;
}

function CycleDetailValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className="tnum mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function CycleStatusOverview({ cycle }: { cycle: DosetteCycle }) {
  const workflowLabel = cycleWorkflowLabel(cycle);
  const isFlagged =
    cycle.status === "CANCELLED" || cycle.status === "NEEDS_CHANGES";

  return (
    <section
      aria-label="Dosette status overview"
      className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge dot variant={cycleStatusTone(cycle.status)}>
              {workflowLabel}
            </Badge>
            <Badge dot variant={dueStatusTone(cycle.due_status)}>
              {dueStatusLabel(cycle.due_status)}
            </Badge>
            {cycle.stock_deducted ? (
              <Badge icon={<CheckCircle2 className="h-3 w-3" />} variant="info">
                Stock deducted
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-3 text-lg font-extrabold text-ink">
            {cycleFriendlyLabel(cycle)}
          </h2>
          <p className="mt-1 text-xs font-semibold text-muted">
            Internal reference:{" "}
            <span className="tnum text-ink-soft">{cycle.reference}</span>
          </p>
          {cycle.is_due_soon ? (
            <p className="mt-2 text-xs font-semibold text-warning-ink">
              Suggested preparation window: within 3 days. Human review required.
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-line bg-surface-subtle px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Current status
          </p>
          <p className="mt-1 text-sm font-extrabold text-ink">{workflowLabel}</p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-surface-subtle px-3 py-4 sm:px-4">
        <StatusTrack
          steps={WORKFLOW_STEPS}
          currentIndex={cycleWorkflowIndex(cycle)}
          tone={isFlagged ? "danger" : "peach"}
        />
      </div>

      <dl className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <CycleDetailValue
          label="Supply period"
          value={cycleSupplyPeriodLabel(cycle)}
        />
        <CycleDetailValue label="Cycle dates" value={cycleDateRange(cycle)} />
        <CycleDetailValue label="Due signal" value={daysUntilDueLabel(cycle)} />
        <CycleDetailValue
          label="Prepared"
          value={preparedCheckedLabel(cycle.prepared_by_email, cycle.prepared_at)}
        />
        <CycleDetailValue
          label="Checked"
          value={preparedCheckedLabel(cycle.checked_by_email, cycle.checked_at)}
        />
        <CycleDetailValue
          label="Stock deducted"
          value={cycle.stock_deducted ? "Yes" : "No"}
        />
        <CycleDetailValue
          label="Deducted at"
          value={optionalDateTime(cycle.deducted_at)}
        />
      </dl>
    </section>
  );
}

function UpcomingCyclePlan({ cycles }: { cycles: DosetteCycle[] }) {
  const plannedCycles = buildUpcomingCyclePlan(cycles);
  if (plannedCycles.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Upcoming cycle plan"
      className="mt-5 rounded-xl border border-line bg-surface-subtle p-4"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-ink">Upcoming cycle plan</h3>
          <p className="mt-1 text-xs font-medium text-muted">
            Predicted dates only. Human review required; create each cycle when
            ready.
          </p>
        </div>
        <Badge variant="info">Planning preview</Badge>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {plannedCycles.map((plannedCycle) => (
          <article
            aria-label={plannedCycle.label}
            className="rounded-xl border border-line bg-surface p-3"
            key={`${plannedCycle.label}-${plannedCycle.start_date}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              {plannedCycle.label}
            </p>
            <p className="mt-1 tnum text-sm font-extrabold text-ink">
              {formatDate(plannedCycle.start_date)} -{" "}
              {formatDate(plannedCycle.end_date)}
            </p>
            <p className="mt-1 text-xs font-semibold text-ink-soft">
              {plannedCycle.supply_period_label}
            </p>
            <p className="mt-2 text-xs font-medium text-muted">
              Suggested preparation window: review before the start date.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CycleCard({
  canDeduct,
  canManage,
  canMarkPrepared,
  canMarkStatus,
  cycle,
  isSelected,
  isStatusPending,
  onCancel,
  onDeduct,
  onEdit,
  onPrepare,
  onSelect,
  onStatusChange,
}: {
  canDeduct: boolean;
  canManage: boolean;
  canMarkPrepared: boolean;
  canMarkStatus: boolean;
  cycle: DosetteCycle;
  isSelected: boolean;
  isStatusPending: boolean;
  onCancel: (cycle: DosetteCycle) => void;
  onDeduct: (cycle: DosetteCycle) => void;
  onEdit: (cycle: DosetteCycle) => void;
  onPrepare: (cycle: DosetteCycle) => void;
  onSelect: (cycle: DosetteCycle) => void;
  onStatusChange: (
    cycle: DosetteCycle,
    status: CycleStatusTransition,
    label: string,
  ) => void;
}) {
  return (
    <article
      aria-label={`Cycle ${cycle.reference}`}
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2",
        isSelected && "border-brand bg-brand-soft/30",
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge dot variant={dueStatusTone(cycle.due_status)}>
              {dueStatusLabel(cycle.due_status)}
            </Badge>
            <Badge dot variant={cycleStatusTone(cycle.status)}>
              {statusLabel(cycle.status)}
            </Badge>
            {cycle.stock_deducted ? (
              <Badge icon={<CheckCircle2 className="h-3 w-3" />} variant="info">
                Stock deducted
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-extrabold text-ink">
            {cycleFriendlyLabel(cycle)}
          </h3>
          <p className="mt-1 text-xs font-semibold text-muted">
            Internal reference:{" "}
            <span className="tnum text-ink-soft">{cycle.reference}</span>
          </p>
          {cycle.is_due_soon ? (
            <p className="mt-2 text-xs font-semibold text-warning-ink">
              Suggested preparation window: within 3 days. Human review required.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button
            leadingIcon={<ClipboardList className="h-4 w-4" />}
            onClick={() => onSelect(cycle)}
            size="sm"
            variant={isSelected ? "primary" : "secondary"}
          >
            Select cycle
          </Button>
          {canManage && canEditCycle(cycle) ? (
            <Button onClick={() => onEdit(cycle)} size="sm" variant="secondary">
              Edit
            </Button>
          ) : null}
          {canMarkPrepared && cycle.status === "DRAFT" ? (
            <Button onClick={() => onPrepare(cycle)} size="sm" variant="secondary">
              Prepare
            </Button>
          ) : null}
          {canMarkPrepared && cycle.status === "PREPARED" ? (
            <Button
              disabled={isStatusPending}
              onClick={() => onStatusChange(cycle, "CHECKED", "Checked")}
              size="sm"
              variant="secondary"
            >
              Mark checked
            </Button>
          ) : null}
          {canDeduct && cycle.status === "PREPARED" && !cycle.stock_deducted ? (
            <Button onClick={() => onDeduct(cycle)} size="sm" variant="secondary">
              Deduct stock
            </Button>
          ) : null}
          {canMarkStatus && ["CHECKED", "PREPARED"].includes(cycle.status) ? (
            <Button
              disabled={isStatusPending}
              onClick={() => onStatusChange(cycle, "COLLECTED", "Collected")}
              size="sm"
              variant="secondary"
            >
              Collected
            </Button>
          ) : null}
          {canMarkStatus && ["COLLECTED", "CHECKED"].includes(cycle.status) ? (
            <Button
              disabled={isStatusPending}
              onClick={() => onStatusChange(cycle, "DELIVERED", "Delivered")}
              size="sm"
              variant="secondary"
            >
              Delivered
            </Button>
          ) : null}
          {canMarkStatus &&
          ["DRAFT", "PREPARED", "CHECKED", "NEEDS_CHANGES"].includes(
            cycle.status,
          ) ? (
            <Button
              disabled={isStatusPending}
              onClick={() => onStatusChange(cycle, "NEEDS_CHANGES", "Needs changes")}
              size="sm"
              variant="ghost"
            >
              Needs changes
            </Button>
          ) : null}
          {canManage && canCancelCycle(cycle) ? (
            <Button onClick={() => onCancel(cycle)} size="sm" variant="danger">
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <CycleDetailValue label="Patient ID" value={cycle.patient_reference} />
        <CycleDetailValue
          label="Supply period"
          value={cycleSupplyPeriodLabel(cycle)}
        />
        <CycleDetailValue label="Cycle dates" value={cycleDateRange(cycle)} />
        <CycleDetailValue label="Due signal" value={daysUntilDueLabel(cycle)} />
        <CycleDetailValue
          label="Prepared"
          value={preparedCheckedLabel(cycle.prepared_by_email, cycle.prepared_at)}
        />
        <CycleDetailValue
          label="Checked"
          value={preparedCheckedLabel(cycle.checked_by_email, cycle.checked_at)}
        />
        <CycleDetailValue
          label="Deducted at"
          value={optionalDateTime(cycle.deducted_at)}
        />
      </dl>
    </article>
  );
}

interface DeductStockShortage {
  medication_id: number;
  medication_name: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
}

interface DeductStockErrorState {
  detail: string;
  deductedAt: string | null;
  shortages: DeductStockShortage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseDeductStockError(error: unknown): DeductStockErrorState {
  if (!(error instanceof ApiError) || !isRecord(error.data)) {
    return {
      detail: "Could not deduct stock.",
      deductedAt: null,
      shortages: [],
    };
  }

  const detail =
    typeof error.data.detail === "string"
      ? error.data.detail
      : "Could not deduct stock.";
  const deductedAt =
    typeof error.data.deducted_at === "string" ? error.data.deducted_at : null;
  const shortages = Array.isArray(error.data.shortages)
    ? error.data.shortages.filter(isDeductStockShortage)
    : [];

  return {
    detail,
    deductedAt,
    shortages,
  };
}

function isDeductStockShortage(value: unknown): value is DeductStockShortage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.medication_id === "number" &&
    typeof value.medication_name === "string" &&
    typeof value.required_quantity === "number" &&
    typeof value.available_quantity === "number" &&
    typeof value.shortage_quantity === "number"
  );
}

function DeductStockError({ error }: { error: DeductStockErrorState }) {
  return (
    <div className="rounded-xl border border-danger-border bg-danger-soft p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-danger-ink">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
        {error.detail}
      </p>
      {error.deductedAt ? (
        <p className="mt-2 text-sm text-danger-ink">
          Deducted at {formatDate(error.deductedAt)}
        </p>
      ) : null}
      {error.shortages.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-danger-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm tnum">
              <thead className="border-b border-danger-border">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-danger-ink">
                    Medication
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-danger-ink">
                    Required
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-danger-ink">
                    Available
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-danger-ink">
                    Shortage
                  </th>
                </tr>
              </thead>
              <tbody>
                {error.shortages.map((shortage) => (
                  <tr
                    key={shortage.medication_id}
                    className="border-b border-danger-border/60 last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-[13px] font-semibold text-ink">
                      {shortage.medication_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[13px] text-ink-soft">
                      {shortage.required_quantity}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[13px] text-ink-soft">
                      {shortage.available_quantity}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[13px] font-semibold text-danger-ink">
                      {shortage.shortage_quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MedicationAppearanceMarker({
  colour,
  shape,
}: {
  colour: string | undefined;
  shape: string | undefined;
}) {
  return (
    <span
      aria-label={`Appearance marker: ${appearanceLabel({ colour, shape })}`}
      className={cn(
        "inline-flex shrink-0 border border-line-strong shadow-inner",
        appearanceShapeClass(shape),
      )}
      role="img"
      style={{ backgroundColor: appearanceColour(colour) }}
    />
  );
}

function MedicationDetailValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function MedicationDoseTile({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      aria-label={`${label} dose ${value}`}
      role="group"
      className="rounded-xl border border-line bg-surface-subtle px-3 py-2"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </p>
      <p className="tnum mt-1 text-lg font-extrabold text-ink">{value}</p>
    </div>
  );
}

function MedicationLineCard({
  canManage,
  canMarkStatus,
  line,
  onDiscontinue,
  onEdit,
  onEditAppearance,
}: {
  canManage: boolean;
  canMarkStatus: boolean;
  line: PatientMedicationLine;
  onDiscontinue: (line: PatientMedicationLine) => void;
  onEdit: (line: PatientMedicationLine) => void;
  onEditAppearance: (line: PatientMedicationLine) => void;
}) {
  const appearance = appearanceLabel(line);

  return (
    <article
      aria-label={`Medication line ${line.medication_name}`}
      className={cn(
        "flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2",
        !line.is_active && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <MedicationAppearanceMarker colour={line.colour} shape={line.shape} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-ink">{line.medication_name}</h3>
              <MedicationStatusBadge value={line.is_active} />
            </div>
            <p className="mt-1 text-xs font-semibold text-muted">
              {strengthFormLabel(line)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {line.dose_instructions.trim()
                ? line.dose_instructions
                : "Dosage instructions not recorded"}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <Badge variant="brand">
            <span className="tnum">{totalDaily(line)}</span>/day
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {SLOT_META.map((slot) => (
          <MedicationDoseTile
            key={slot.key}
            label={slot.label}
            value={line[slot.key]}
          />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-subtle p-3">
        <MedicationDetailValue label="Strength" value={safeText(line.strength)} />
        <MedicationDetailValue label="Form" value={safeText(line.form)} />
        <MedicationDetailValue label="Colour" value={safeText(line.colour)} />
        <MedicationDetailValue label="Shape" value={safeText(line.shape)} />
        <MedicationDetailValue
          label="Start date"
          value={optionalDate(line.start_date)}
        />
      </dl>

      <p
        className={cn(
          "mt-3 text-xs font-medium text-muted",
          (canManage || canMarkStatus) && "mb-4",
        )}
      >
        Appearance: {appearance}
      </p>

      {canManage || canMarkStatus ? (
        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          {canMarkStatus ? (
            <Button
              onClick={() => onEditAppearance(line)}
              size="sm"
              variant="secondary"
            >
              Appearance
            </Button>
          ) : null}
          {canManage ? (
            <Button onClick={() => onEdit(line)} size="sm" variant="secondary">
              Edit
            </Button>
          ) : null}
          {canManage && line.is_active ? (
            <Button
              onClick={() => onDiscontinue(line)}
              size="sm"
              variant="danger"
            >
              Discontinue
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function PickingListRowView({ row }: { row: PickingListRow }) {
  return (
    <TR>
      <TD className="whitespace-nowrap font-semibold text-ink">
        {row.medication_name}
      </TD>
      <TD className="whitespace-nowrap">
        {row.strength} / {row.form}
      </TD>
      <TD className="tnum whitespace-nowrap text-ink-soft">
        {row.quantity_morning}
      </TD>
      <TD className="tnum whitespace-nowrap text-ink-soft">
        {row.quantity_lunchtime}
      </TD>
      <TD className="tnum whitespace-nowrap text-ink-soft">
        {row.quantity_evening}
      </TD>
      <TD className="tnum whitespace-nowrap text-ink-soft">
        {row.quantity_bedtime}
      </TD>
      <TD className="tnum whitespace-nowrap font-bold text-ink">
        {row.total_daily}
      </TD>
    </TR>
  );
}

function MedicationTableHeader({
  includeStatus = false,
  includeAction = false,
}: {
  includeStatus?: boolean;
  includeAction?: boolean;
}) {
  return (
    <THead>
      <tr>
        <TH>Medication</TH>
        <TH>Strength/Form</TH>
        <TH>Morning</TH>
        <TH>Lunchtime</TH>
        <TH>Evening</TH>
        <TH>Bedtime</TH>
        <TH>Total daily</TH>
        {includeStatus ? <TH>Status</TH> : null}
        {includeAction ? <TH className="text-right">Action</TH> : null}
      </tr>
    </THead>
  );
}

function LoadingSection({ text }: { text: string }) {
  return (
    <Panel>
      <PanelBody>
        <p className="mb-4 flex items-center gap-2 text-sm font-medium text-muted">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand"
          />
          {text}
        </p>
        <SkeletonRows rows={4} />
      </PanelBody>
    </Panel>
  );
}

function ErrorSection({
  onRetry,
  title,
}: {
  onRetry: () => void;
  title: string;
}) {
  return (
    <EmptyState
      action={
        <Button onClick={onRetry} variant="primary">
          Retry
        </Button>
      }
      description="Please retry. Your session or permissions may need refreshing."
      icon={<AlertTriangle className="h-5 w-5" />}
      title={title}
      tone="danger"
    />
  );
}

function PickingListSection({
  cycle,
  pickingList,
}: {
  cycle: DosetteCycle | null;
  pickingList: PickingList;
}) {
  const internalReference = cycle?.reference ?? pickingList.cycle.reference;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft animate-fade-in-up">
      <div className="flex flex-col gap-1 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
          >
            <Grid3x3 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              {pickingList.patient_reference}
            </p>
            <h2 className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
              Picking list: {cycle ? cycleFriendlyLabel(cycle) : internalReference}
            </h2>
            {cycle ? (
              <p className="mt-0.5 text-[11px] font-semibold text-muted">
                Internal reference:{" "}
                <span className="tnum">{internalReference}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {/* Pack lifecycle route track (ShipMates-style). */}
      <div className="border-b border-line px-4 py-5 sm:px-6">
        <StatusTrack
          steps={PACK_STEPS}
          currentIndex={packStatusIndex(pickingList.cycle.status)}
          tone={pickingList.cycle.status === "NEEDS_CHANGES" ? "danger" : "peach"}
        />
      </div>
      {pickingList.medications.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No active medication lines for this cycle."
            description="Add an active medication line to build this pack."
          />
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-5">
          {/* Tactile blister trays — one per medication, slots × days. */}
          <div className="grid gap-4 lg:grid-cols-2">
            {pickingList.medications.map((row) => (
              <article
                key={`tray-${row.medication_id}`}
                className="rounded-2xl border border-line bg-surface p-4 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                      <Pill
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-brand"
                      />
                      <span>
                        {`${row.medication_name} · ${row.strength} / ${row.form}`}
                      </span>
                    </p>
                    {row.colour || row.shape ? (
                      <p className="mt-1 text-[11px] font-medium text-muted">
                        Label: {[row.colour, row.shape].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="brand">
                    <span className="tnum">{row.total_daily}</span>/day
                  </Badge>
                </div>
                <BlisterTray row={row} />
              </article>
            ))}
          </div>

          {/* Per-medication breakdown the picking team works from. */}
          <TableScroll>
            <Table>
              <MedicationTableHeader />
              <TBody>
                {pickingList.medications.map((row) => (
                  <PickingListRowView key={row.medication_id} row={row} />
                ))}
              </TBody>
              <tfoot className="border-t border-line bg-surface-subtle">
                <tr>
                  <td
                    className="whitespace-nowrap px-3 py-3 text-[13px] font-bold text-ink"
                    colSpan={2}
                  >
                    Totals
                  </td>
                  <td className="tnum px-3 py-3 text-[13px] font-bold text-ink">
                    {pickingList.totals.morning}
                  </td>
                  <td className="tnum px-3 py-3 text-[13px] font-bold text-ink">
                    {pickingList.totals.lunchtime}
                  </td>
                  <td className="tnum px-3 py-3 text-[13px] font-bold text-ink">
                    {pickingList.totals.evening}
                  </td>
                  <td className="tnum px-3 py-3 text-[13px] font-bold text-ink">
                    {pickingList.totals.bedtime}
                  </td>
                  <td className="tnum px-3 py-3 text-[13px] font-bold text-ink">
                    {pickingList.totals.total_daily}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </TableScroll>
        </div>
      )}
    </section>
  );
}

const PRINT_DISCLAIMER =
  "This sheet is for pharmacy Dosette preparation and patient/carer identification support. Human review required.";

function DosettePrintMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
        {label}
      </dt>
      <dd className="tnum mt-1 text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

function preparedCheckedLabel(
  email: string | null,
  timestamp: string | null,
): string {
  if (!email && !timestamp) {
    return "Not recorded";
  }

  return [email, timestamp ? formatDateTime(timestamp) : null]
    .filter(Boolean)
    .join(" · ");
}

function DosettePrintSheet({
  cycle,
  medicationLines,
  patientReference,
  pharmacyName,
  printedAt,
}: {
  cycle: DosetteCycle;
  medicationLines: PatientMedicationLine[];
  patientReference: string;
  pharmacyName: string;
  printedAt: Date;
}) {
  return (
    <section
      aria-label="Dosette medication sheet"
      className="dosette-print-sheet rounded-2xl border border-line bg-white p-6 text-ink shadow-soft"
    >
      <header className="border-b border-line pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
              Pharmacy Dosette preparation sheet
            </p>
            <h2 className="mt-1 text-2xl font-extrabold text-ink">
              {pharmacyName}
            </h2>
          </div>
          <Badge dot variant={cycleStatusTone(cycle.status)}>
            {statusLabel(cycle.status)}
          </Badge>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DosettePrintMeta label="Patient reference" value={patientReference} />
          <DosettePrintMeta label="Cycle" value={cycleFriendlyLabel(cycle)} />
          <DosettePrintMeta label="Internal reference" value={cycle.reference} />
          <DosettePrintMeta
            label="Cycle dates"
            value={`${formatDate(cycle.start_date)} - ${formatDate(cycle.end_date)}`}
          />
          <DosettePrintMeta label="Printed date" value={formatDateTime(printedAt)} />
          <DosettePrintMeta
            label="Prepared"
            value={preparedCheckedLabel(cycle.prepared_by_email, cycle.prepared_at)}
          />
          <DosettePrintMeta
            label="Checked"
            value={preparedCheckedLabel(cycle.checked_by_email, cycle.checked_at)}
          />
          <DosettePrintMeta
            label="Stock deducted"
            value={cycle.stock_deducted ? "Yes" : "No"}
          />
          <DosettePrintMeta
            label="Deducted at"
            value={optionalDateTime(cycle.deducted_at)}
          />
        </dl>
      </header>

      <div className="mt-5 overflow-hidden rounded-xl border border-line">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle">
            <tr>
              <th className="px-3 py-2 font-extrabold text-ink">Medication</th>
              <th className="px-3 py-2 font-extrabold text-ink">Strength/Form</th>
              <th className="px-3 py-2 font-extrabold text-ink">
                Dosage instructions
              </th>
              <th className="px-3 py-2 text-center font-extrabold text-ink">
                Morning
              </th>
              <th className="px-3 py-2 text-center font-extrabold text-ink">
                Lunchtime
              </th>
              <th className="px-3 py-2 text-center font-extrabold text-ink">
                Evening
              </th>
              <th className="px-3 py-2 text-center font-extrabold text-ink">
                Bedtime
              </th>
              <th className="px-3 py-2 font-extrabold text-ink">Colour</th>
              <th className="px-3 py-2 font-extrabold text-ink">Shape</th>
              <th className="px-3 py-2 font-extrabold text-ink">Start date</th>
            </tr>
          </thead>
          <tbody>
            {medicationLines.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-muted" colSpan={10}>
                  No active medication lines recorded for this sheet.
                </td>
              </tr>
            ) : (
              medicationLines.map((line) => (
                <tr className="border-t border-line" key={line.id}>
                  <td className="px-3 py-2 font-bold text-ink">
                    {line.medication_name}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">
                    {strengthFormLabel(line)}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">
                    {line.dose_instructions.trim()
                      ? line.dose_instructions
                      : "Not recorded"}
                  </td>
                  <td className="tnum px-3 py-2 text-center font-bold">
                    {line.quantity_morning}
                  </td>
                  <td className="tnum px-3 py-2 text-center font-bold">
                    {line.quantity_lunchtime}
                  </td>
                  <td className="tnum px-3 py-2 text-center font-bold">
                    {line.quantity_evening}
                  </td>
                  <td className="tnum px-3 py-2 text-center font-bold">
                    {line.quantity_bedtime}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">
                    {safeText(line.colour)}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">
                    {safeText(line.shape)}
                  </td>
                  <td className="tnum px-3 py-2 text-ink-soft">
                    {optionalDate(line.start_date)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="mt-5 border-t border-line pt-3 text-xs font-semibold leading-relaxed text-ink-soft">
        {PRINT_DISCLAIMER}
      </footer>
    </section>
  );
}

function StockAvailabilityBadge({ inStock }: { inStock: boolean }) {
  return inStock ? (
    <Badge dot variant="success">
      In stock
    </Badge>
  ) : (
    <Badge dot variant="warning">
      Shortage
    </Badge>
  );
}

function StockPreviewRowView({ row }: { row: StockPreviewRow }) {
  return (
    <TR>
      <TD className="whitespace-nowrap font-semibold text-ink">
        {row.medication_name}
      </TD>
      <TD className="whitespace-nowrap">
        {row.strength} / {row.form}
      </TD>
      <TD className="tnum whitespace-nowrap text-ink-soft">
        {row.required_quantity}
      </TD>
      <TD className="tnum whitespace-nowrap text-ink-soft">
        {row.available_quantity}
      </TD>
      <TD
        className={cn(
          "tnum whitespace-nowrap font-semibold",
          row.shortage_quantity > 0 ? "text-danger-ink" : "text-ink-soft",
        )}
      >
        {row.shortage_quantity}
      </TD>
      <TD className="whitespace-nowrap">
        <StockAvailabilityBadge inStock={row.in_stock} />
      </TD>
      <TD>
        {row.suggested_batches.length === 0 ? (
          <span className="text-muted">No batches suggested</span>
        ) : (
          <ul className="space-y-1">
            {row.suggested_batches.map((batch) => (
              <li key={batch.batch_id} className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">
                  {batch.batch_number}
                </span>
                <span className="tnum text-muted">
                  {formatDate(batch.expiry_date)} - pick {batch.quantity_to_pick}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TD>
    </TR>
  );
}

function StockPreviewSection({ stockPreview }: { stockPreview: StockPreview }) {
  const hasShortage = stockPreview.totals.shortage > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft animate-fade-in-up">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
          >
            <PackageCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              {stockPreview.patient_reference}
            </p>
            <h2 className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
              Stock availability
            </h2>
          </div>
        </div>
        {stockPreview.medications.length > 0 ? (
          hasShortage ? (
            <Badge dot variant="warning">
              <span className="tnum">{stockPreview.totals.shortage}</span> short
            </Badge>
          ) : (
            <Badge dot variant="success">
              Fully covered
            </Badge>
          )
        ) : null}
      </div>
      {stockPreview.medications.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={<PackageCheck className="h-5 w-5" />}
            title="No active medication lines to preview."
            description="Add an active medication line to preview stock."
          />
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <TableScroll>
            <Table>
              <THead>
                <tr>
                  <TH>Medication</TH>
                  <TH>Strength/Form</TH>
                  <TH>Required</TH>
                  <TH>Available</TH>
                  <TH>Shortage</TH>
                  <TH>Status</TH>
                  <TH>Suggested FEFO batches</TH>
                </tr>
              </THead>
              <TBody>
                {stockPreview.medications.map((row) => (
                  <StockPreviewRowView key={row.medication_id} row={row} />
                ))}
              </TBody>
              <tfoot className="border-t border-line bg-surface-subtle">
                <tr>
                  <td
                    className="whitespace-nowrap px-3 py-3 text-[13px] font-bold text-ink"
                    colSpan={2}
                  >
                    Totals
                  </td>
                  <td className="tnum px-3 py-3 text-[13px] font-bold text-ink">
                    {stockPreview.totals.required}
                  </td>
                  <td className="tnum px-3 py-3 text-[13px] font-bold text-ink">
                    {stockPreview.totals.available}
                  </td>
                  <td className="tnum px-3 py-3 text-[13px] font-bold text-ink">
                    {stockPreview.totals.shortage}
                  </td>
                  <td className="px-3 py-3" colSpan={2} />
                </tr>
              </tfoot>
            </Table>
          </TableScroll>
        </div>
      )}
    </section>
  );
}

function PickingListGate({
  cycle,
  hasGenerated,
  isBusy,
  onGenerate,
  onRefresh,
}: {
  cycle: DosetteCycle | null;
  hasGenerated: boolean;
  isBusy: boolean;
  onGenerate: () => void;
  onRefresh: () => void;
}) {
  return (
    <Panel>
      <PanelHeader
        icon={<ClipboardList className="h-4 w-4" />}
        title="Generate picking list"
        subtitle="Show the on-screen stock gathering view only when the team is ready."
        actions={
          cycle ? (
            hasGenerated ? (
              <Button
                disabled={isBusy}
                leadingIcon={<RefreshCw className="h-4 w-4" />}
                onClick={onRefresh}
                variant="secondary"
              >
                Refresh picking list
              </Button>
            ) : (
              <Button
                disabled={isBusy}
                leadingIcon={<ClipboardList className="h-4 w-4" />}
                onClick={onGenerate}
                variant="primary"
              >
                Generate picking list
              </Button>
            )
          ) : null
        }
      />
      <PanelBody>
        {cycle ? (
          <div className="rounded-xl border border-line bg-surface-subtle p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                  Selected cycle
                </p>
                <h3 className="mt-1 text-sm font-extrabold text-ink">
                  {cycleFriendlyLabel(cycle)}
                </h3>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  Generate a picking list when you are ready to gather stock for
                  this Dosette cycle.
                </p>
              </div>
              <Badge dot variant={cycleStatusTone(cycle.status)}>
                {cycleWorkflowLabel(cycle)}
              </Badge>
            </div>
            {hasGenerated ? (
              <p className="mt-3 text-xs font-semibold text-success-ink">
                Picking list generated for this selected cycle.
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="Select a cycle before generating."
            description="Choose a Dosette cycle above, then generate the picking list when stock gathering is ready."
          />
        )}
      </PanelBody>
    </Panel>
  );
}

export function DosetteScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { success, error: toastError } = useToast();
  const canManage = can("blister.manage");
  const canMarkPrepared = can("blister.mark_prepared");
  const canMarkStatus = can("blister.mark_status");
  const canDeduct = can("blister.deduct");
  const { patientId } = useParams();
  const parsedPatientId = Number(patientId);
  const isValidPatientId = Number.isFinite(parsedPatientId);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [generatedCycleId, setGeneratedCycleId] = useState<number | null>(null);
  const [editingLine, setEditingLine] = useState<PatientMedicationLine | null>(null);
  const [isMedicationModalOpen, setMedicationModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<DosetteCycle | null>(null);
  const [isCycleModalOpen, setCycleModalOpen] = useState(false);
  const [cycleToPrepare, setCycleToPrepare] = useState<DosetteCycle | null>(null);
  const [cycleToDeduct, setCycleToDeduct] = useState<DosetteCycle | null>(null);
  const [deductStockError, setDeductStockError] =
    useState<DeductStockErrorState | null>(null);
  const [cycleToCancel, setCycleToCancel] = useState<DosetteCycle | null>(null);
  const [lineToDiscontinue, setLineToDiscontinue] =
    useState<PatientMedicationLine | null>(null);
  const [appearanceLine, setAppearanceLine] =
    useState<PatientMedicationLine | null>(null);
  const [appearanceColour, setAppearanceColour] = useState("");
  const [appearanceShape, setAppearanceShape] = useState("");
  const [isPrintModalOpen, setPrintModalOpen] = useState(false);
  const medicationsQuery = usePatientMedicationsQuery(parsedPatientId);
  const cyclesQuery = useDosetteCyclesQuery(parsedPatientId);
  const pickingListQuery = usePickingListQuery(parsedPatientId, generatedCycleId);
  const stockPreviewQuery = useStockPreviewQuery(parsedPatientId, generatedCycleId);
  const discontinueMedication =
    useDiscontinuePatientMedication(parsedPatientId);
  const prepareCycle = usePrepareDosetteCycle(parsedPatientId);
  const deductCycle = useDeductDosetteStock(parsedPatientId);
  const cancelCycle = useCancelDosetteCycle(parsedPatientId);
  const updateStatus = useUpdateCycleStatus(parsedPatientId);
  const updateAppearance = useUpdateMedicationAppearance(parsedPatientId);

  useEffect(() => {
    if (!cyclesQuery.isSuccess) {
      return;
    }

    setSelectedCycleId((current) => {
      if (cyclesQuery.data.length === 0) {
        return null;
      }
      if (current !== null && cyclesQuery.data.some((cycle) => cycle.id === current)) {
        return current;
      }

      return cyclesQuery.data[0].id;
    });
  }, [cyclesQuery.data, cyclesQuery.isSuccess]);

  useEffect(() => {
    if (generatedCycleId !== null && generatedCycleId !== selectedCycleId) {
      setGeneratedCycleId(null);
    }
  }, [generatedCycleId, selectedCycleId]);

  function openAppearanceModal(line: PatientMedicationLine) {
    setAppearanceLine(line);
    setAppearanceColour(line.colour ?? "");
    setAppearanceShape(line.shape ?? "");
  }

  const closeAppearanceModal = useCallback(() => {
    setAppearanceLine(null);
  }, []);

  async function handleStatusChange(
    cycle: DosetteCycle,
    status: CycleStatusTransition,
    label: string,
  ) {
    try {
      await updateStatus.mutateAsync({ id: cycle.id, status });
      success(`Marked ${label.toLowerCase()}`, cycle.reference);
    } catch {
      toastError(`Could not mark ${label.toLowerCase()}`, "Please try again.");
    }
  }

  function openCreateMedicationModal() {
    setEditingLine(null);
    setMedicationModalOpen(true);
  }

  function openEditMedicationModal(line: PatientMedicationLine) {
    setEditingLine(line);
    setMedicationModalOpen(true);
  }

  function openCreateCycleModal() {
    setEditingCycle(null);
    setCycleModalOpen(true);
  }

  function openEditCycleModal(cycle: DosetteCycle) {
    setEditingCycle(cycle);
    setCycleModalOpen(true);
  }

  function handleSelectCycle(cycle: DosetteCycle) {
    setSelectedCycleId(cycle.id);
    setGeneratedCycleId(null);
  }

  function handleGeneratePickingList() {
    if (selectedCycleId === null) {
      return;
    }

    setGeneratedCycleId(selectedCycleId);
  }

  function handleRefreshPickingList() {
    void pickingListQuery.refetch();
    void stockPreviewQuery.refetch();
  }

  function openDeductStockModal(cycle: DosetteCycle) {
    setDeductStockError(null);
    setCycleToDeduct(cycle);
  }

  function closeDeductStockModal() {
    if (deductCycle.isPending) {
      return;
    }
    setDeductStockError(null);
    setCycleToDeduct(null);
  }

  if (!isValidPatientId) {
    return (
      <div className="space-y-5">
        <EmptyState
          action={
            <Link to="/patients">
              <Button variant="primary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                Back to patients
              </Button>
            </Link>
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          title="This patient was not found or is outside your access."
          tone="danger"
        />
      </div>
    );
  }

  const cycleCount = cyclesQuery.data?.length ?? 0;
  const cycles = cyclesQuery.data ?? [];
  const medicationLines = medicationsQuery.data ?? [];
  const selectedCycle =
    cycles.find((cycle) => cycle.id === selectedCycleId) ?? null;
  const statusCycle = selectedCycle ?? cycles[0] ?? null;
  const generatedCycle =
    cycles.find((cycle) => cycle.id === generatedCycleId) ?? null;
  const printableCycle = selectedCycle ?? cycles[0] ?? null;
  const printableMedicationLines = medicationLines.filter((line) => line.is_active);
  const patientReference =
    pickingListQuery.data?.patient_reference ??
    printableCycle?.patient_reference ??
    `Patient #${parsedPatientId}`;
  const pharmacyName =
    user?.pharmacies.length === 1
      ? user.pharmacies[0].name
      : user?.pharmacies.length
        ? user.pharmacies.map((pharmacy) => pharmacy.name).join(", ")
        : "Assigned pharmacy";
  const activeLineCount =
    medicationLines.filter((line) => line.is_active).length ?? 0;
  const hasGeneratedPickingList =
    selectedCycleId !== null && generatedCycleId === selectedCycleId;
  const isPickingListBusy =
    pickingListQuery.isFetching || stockPreviewQuery.isFetching;

  function handlePrintSheet() {
    window.print();
  }

  return (
    <div className="stagger space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Link
              className="inline-flex items-center gap-1 text-brand transition-colors duration-150 hover:text-brand-hover focus-ring rounded"
              to={`/patients/${parsedPatientId}`}
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              Back to patient
            </Link>
          </span>
        }
        title="Dosette / MDS"
        subtitle="Assemble the patient's compliance pack by day and time slot, then preview FEFO stock before deduction."
        actions={
          medicationsQuery.isSuccess && cyclesQuery.isSuccess ? (
            <Button
              disabled={!printableCycle}
              leadingIcon={<Printer className="h-4 w-4" />}
              onClick={() => setPrintModalOpen(true)}
              variant="secondary"
            >
              Print Dosette sheet
            </Button>
          ) : null
        }
        meta={
          medicationsQuery.isSuccess && cyclesQuery.isSuccess ? (
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Pill aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="tnum">{activeLineCount}</span> active line
                {activeLineCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarRange aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="tnum">{cycleCount}</span> cycle
                {cycleCount === 1 ? "" : "s"}
              </span>
            </span>
          ) : null
        }
      />

      {cyclesQuery.isLoading ? <LoadingSection text="Loading cycles..." /> : null}
      {cyclesQuery.isError ? (
        <ErrorSection
          onRetry={() => void cyclesQuery.refetch()}
          title="Could not load cycles."
        />
      ) : null}
      {cyclesQuery.isSuccess ? (
        <Panel>
          <PanelHeader
            icon={<CalendarRange className="h-4 w-4" />}
            title="Dosette status"
            subtitle="Track the selected cycle before generating the picking list."
            actions={
              canManage ? (
                <Button
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={openCreateCycleModal}
                  variant="primary"
                >
                  Add cycle
                </Button>
              ) : null
            }
          />
          {cyclesQuery.data.length === 0 ? (
            <PanelBody>
              <EmptyState
                icon={<CalendarRange className="h-5 w-5" />}
                title="No dosette cycles yet."
                description={
                  canManage
                    ? "Create a cycle to schedule a compliance pack run."
                    : "Cycles will appear here once scheduled."
                }
                action={
                  canManage ? (
                    <Button
                      leadingIcon={<Plus className="h-4 w-4" />}
                      onClick={openCreateCycleModal}
                      variant="primary"
                    >
                      Add cycle
                    </Button>
                  ) : undefined
                }
              />
            </PanelBody>
          ) : (
            <PanelBody>
              {statusCycle ? <CycleStatusOverview cycle={statusCycle} /> : null}
              <div className="mt-4 grid gap-4">
                {cyclesQuery.data.map((cycle: DosetteCycle) => (
                  <CycleCard
                    canDeduct={canDeduct}
                    canManage={canManage}
                    canMarkPrepared={canMarkPrepared}
                    canMarkStatus={canMarkStatus}
                    cycle={cycle}
                    isSelected={selectedCycleId === cycle.id}
                    isStatusPending={updateStatus.isPending}
                    key={cycle.id}
                    onCancel={setCycleToCancel}
                    onDeduct={openDeductStockModal}
                    onEdit={openEditCycleModal}
                    onPrepare={setCycleToPrepare}
                    onSelect={handleSelectCycle}
                    onStatusChange={(selectedCycle, status, label) => {
                      void handleStatusChange(selectedCycle, status, label);
                    }}
                  />
                ))}
              </div>
              <UpcomingCyclePlan cycles={cyclesQuery.data} />
            </PanelBody>
          )}
        </Panel>
      ) : null}

      {medicationsQuery.isLoading ? (
        <LoadingSection text="Loading medication lines..." />
      ) : null}
      {medicationsQuery.isError ? (
        <ErrorSection
          onRetry={() => void medicationsQuery.refetch()}
          title="Could not load medication lines."
        />
      ) : null}
      {medicationsQuery.isSuccess ? (
        <Panel>
          <PanelHeader
            icon={<Pill className="h-4 w-4" />}
            title="Medication lines"
            subtitle="Per-slot doses that fill the pack each day."
            actions={
              canManage ? (
                <Button
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={openCreateMedicationModal}
                  variant="primary"
                >
                  Add medication
                </Button>
              ) : null
            }
          />
          {medicationsQuery.data.length === 0 ? (
            <PanelBody>
              <EmptyState
                icon={<Pill className="h-5 w-5" />}
                title="No medication lines yet."
                description={
                  canManage
                    ? "Add the first medication line to start building packs."
                    : "Medication lines will appear here once added."
                }
                action={
                  canManage ? (
                    <Button
                      leadingIcon={<Plus className="h-4 w-4" />}
                      onClick={openCreateMedicationModal}
                      variant="primary"
                    >
                      Add medication
                    </Button>
                  ) : undefined
                }
              />
            </PanelBody>
          ) : (
            <PanelBody>
              <div
                aria-label="Medication line cards"
                role="list"
                className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              >
                {medicationsQuery.data.map((line) => (
                  <div key={line.id} className="min-w-0" role="listitem">
                    <MedicationLineCard
                      canManage={canManage}
                      canMarkStatus={canMarkStatus}
                      line={line}
                      onDiscontinue={setLineToDiscontinue}
                      onEdit={openEditMedicationModal}
                      onEditAppearance={openAppearanceModal}
                    />
                  </div>
                ))}
              </div>
            </PanelBody>
          )}
        </Panel>
      ) : null}

      {cyclesQuery.isSuccess && cyclesQuery.data.length > 0 ? (
        <PickingListGate
          cycle={selectedCycle}
          hasGenerated={hasGeneratedPickingList}
          isBusy={isPickingListBusy}
          onGenerate={handleGeneratePickingList}
          onRefresh={handleRefreshPickingList}
        />
      ) : null}
      {hasGeneratedPickingList && pickingListQuery.isLoading ? (
        <LoadingSection text="Loading picking list..." />
      ) : null}
      {hasGeneratedPickingList && pickingListQuery.isError ? (
        <ErrorSection
          onRetry={() => void pickingListQuery.refetch()}
          title="Could not load picking list."
        />
      ) : null}
      {hasGeneratedPickingList && pickingListQuery.isSuccess ? (
        <PickingListSection
          cycle={generatedCycle}
          pickingList={pickingListQuery.data}
        />
      ) : null}
      {hasGeneratedPickingList && stockPreviewQuery.isLoading ? (
        <LoadingSection text="Loading stock availability..." />
      ) : null}
      {hasGeneratedPickingList && stockPreviewQuery.isError ? (
        <ErrorSection
          onRetry={() => void stockPreviewQuery.refetch()}
          title="Could not load stock availability."
        />
      ) : null}
      {hasGeneratedPickingList && stockPreviewQuery.isSuccess ? (
        <StockPreviewSection stockPreview={stockPreviewQuery.data} />
      ) : null}

      <Modal
        description="Preview the A4 landscape sheet before printing."
        isOpen={isPrintModalOpen && printableCycle !== null}
        onClose={() => setPrintModalOpen(false)}
        size="xl"
        title="Print Dosette sheet"
      >
        {printableCycle ? (
          <div className="dosette-print-shell space-y-5">
            <div className="dosette-print-actions flex flex-wrap justify-end gap-3">
              <Button
                onClick={() => setPrintModalOpen(false)}
                variant="secondary"
              >
                Close
              </Button>
              <Button
                leadingIcon={<Printer className="h-4 w-4" />}
                onClick={handlePrintSheet}
                variant="primary"
              >
                Print sheet
              </Button>
            </div>
            <DosettePrintSheet
              cycle={printableCycle}
              medicationLines={printableMedicationLines}
              patientReference={patientReference}
              pharmacyName={pharmacyName}
              printedAt={new Date()}
            />
          </div>
        ) : null}
      </Modal>

      <PatientMedicationFormModal
        isOpen={isMedicationModalOpen}
        line={editingLine}
        onClose={() => setMedicationModalOpen(false)}
        patientId={parsedPatientId}
      />

      <DosetteCycleFormModal
        cycle={editingCycle}
        isOpen={isCycleModalOpen}
        onClose={() => setCycleModalOpen(false)}
        patientId={parsedPatientId}
      />

      <Modal
        isOpen={cycleToPrepare !== null}
        onClose={() => setCycleToPrepare(null)}
        size="sm"
        title="Prepare this cycle?"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-ink-soft">
            This cycle will move from draft to prepared.
          </p>
          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button onClick={() => setCycleToPrepare(null)} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={prepareCycle.isPending}
              onClick={async () => {
                if (!cycleToPrepare) {
                  return;
                }
                try {
                  await prepareCycle.mutateAsync(cycleToPrepare.id);
                  success("Cycle prepared", cycleToPrepare.reference);
                  setCycleToPrepare(null);
                } catch {
                  toastError("Could not prepare cycle", "Please try again.");
                }
              }}
              variant="primary"
            >
              {prepareCycle.isPending ? "Preparing..." : "Prepare"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cycleToDeduct !== null}
        onClose={closeDeductStockModal}
        title="Deduct stock for this cycle?"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-ink-soft">
            This will permanently reduce inventory using FEFO allocation. It cannot
            be undone in the current version.
          </p>
          {deductStockError ? <DeductStockError error={deductStockError} /> : null}
          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button
              disabled={deductCycle.isPending}
              onClick={closeDeductStockModal}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={deductCycle.isPending}
              onClick={async () => {
                if (!cycleToDeduct) {
                  return;
                }
                setDeductStockError(null);
                try {
                  await deductCycle.mutateAsync(cycleToDeduct.id);
                  success("Stock deducted", cycleToDeduct.reference);
                  setCycleToDeduct(null);
                } catch (error) {
                  setDeductStockError(parseDeductStockError(error));
                }
              }}
              variant="primary"
            >
              {deductCycle.isPending ? "Deducting..." : "Deduct stock"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cycleToCancel !== null}
        onClose={() => setCycleToCancel(null)}
        size="sm"
        title="Cancel this cycle?"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-ink-soft">
            This cycle will be marked cancelled.
          </p>
          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button onClick={() => setCycleToCancel(null)} variant="secondary">
              Keep cycle
            </Button>
            <Button
              disabled={cancelCycle.isPending}
              onClick={async () => {
                if (!cycleToCancel) {
                  return;
                }
                try {
                  await cancelCycle.mutateAsync(cycleToCancel.id);
                  success("Cycle cancelled", cycleToCancel.reference);
                  setCycleToCancel(null);
                } catch {
                  toastError("Could not cancel cycle", "Please try again.");
                }
              }}
              variant="danger"
            >
              {cancelCycle.isPending ? "Cancelling..." : "Cancel cycle"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={lineToDiscontinue !== null}
        onClose={() => setLineToDiscontinue(null)}
        size="sm"
        title="Discontinue medication line?"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-ink-soft">
            This medication line will be marked inactive and removed from active
            picking lists.
          </p>
          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button onClick={() => setLineToDiscontinue(null)} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={discontinueMedication.isPending}
              onClick={async () => {
                if (!lineToDiscontinue) {
                  return;
                }
                try {
                  await discontinueMedication.mutateAsync(lineToDiscontinue.id);
                  success(
                    "Medication discontinued",
                    lineToDiscontinue.medication_name,
                  );
                  setLineToDiscontinue(null);
                } catch {
                  toastError(
                    "Could not discontinue medication",
                    "Please try again.",
                  );
                }
              }}
              variant="danger"
            >
              {discontinueMedication.isPending ? "Discontinuing..." : "Discontinue"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={appearanceLine !== null}
        onClose={closeAppearanceModal}
        size="sm"
        title="Label appearance"
        description="Record the colour and shape printed on the pack label so staff can verify tablets by sight."
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelClass}>
              Colour
              <input
                className={inputClass}
                onChange={(event) => setAppearanceColour(event.target.value)}
                placeholder="e.g. White"
                type="text"
                value={appearanceColour}
              />
            </label>
            <label className={labelClass}>
              Shape
              <input
                className={inputClass}
                onChange={(event) => setAppearanceShape(event.target.value)}
                placeholder="e.g. Round"
                type="text"
                value={appearanceShape}
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button onClick={closeAppearanceModal} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={updateAppearance.isPending}
              onClick={async () => {
                if (!appearanceLine) {
                  return;
                }
                try {
                  await updateAppearance.mutateAsync({
                    id: appearanceLine.id,
                    body: {
                      colour: appearanceColour.trim(),
                      shape: appearanceShape.trim(),
                    },
                  });
                  success("Label appearance saved", appearanceLine.medication_name);
                  closeAppearanceModal();
                } catch {
                  toastError("Could not save appearance", "Please try again.");
                }
              }}
              variant="primary"
            >
              {updateAppearance.isPending ? "Saving..." : "Save appearance"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
