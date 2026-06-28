import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
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
import { useToast } from "../../components/ui/Toast";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  textareaClass,
} from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import { ApiError } from "../../lib/apiClient";
import {
  errorMessages,
  normalizeErrors,
  type FieldErrors,
} from "../../lib/apiErrors";
import { CatalogueProductSelect } from "../catalogue/CatalogueProductSelect";
import type { CatalogueProduct } from "../catalogue/catalogueApi";
import { DosetteCycleFormModal } from "./DosetteCycleFormModal";
import { PatientMedicationFormModal } from "./PatientMedicationFormModal";
import type {
  DosetteCycle,
  DosettePeriod,
  DosettePeriodCycle,
  PatientMedicationLine,
  PatientMedicationWriteBody,
  PickingList,
  PickingListRow,
  StockPreview,
  StockPreviewRow,
} from "./dosetteApi";
import type { CycleStatusTransition } from "./dosetteApi";
import {
  useCancelDosetteCycle,
  useCreatePatientMedication,
  useDeductDosetteStock,
  useDiscontinuePatientMedication,
  useDosetteCyclesQuery,
  useDosettePeriodsQuery,
  useMarkDosettePeriodCollected,
  usePatientMedicationsQuery,
  usePickingListQuery,
  usePrepareDosetteCycle,
  useSubmitDosettePeriod,
  useStockPreviewQuery,
  useUpdateCycleStatus,
  useUpdateMedicationAppearance,
  useUpdatePatientMedication,
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

function cycleWorkflowLabel(cycle: DosetteCycle): string {
  if (cycle.status === "CANCELLED" || cycle.status === "NEEDS_CHANGES") {
    return statusLabel(cycle.status);
  }
  if (cycle.stock_deducted && !["COLLECTED", "DELIVERED", "COMPLETED"].includes(cycle.status)) {
    return "Stock deducted";
  }
  if (cycle.status === "DRAFT") {
    return "Draft";
  }

  return statusLabel(cycle.status);
}

type ChecklistState = "done" | "current" | "pending";

interface CycleChecklistStep {
  key: string;
  label: string;
  state: ChecklistState;
}

function isCyclePrepared(cycle: DosetteCycle): boolean {
  return (
    Boolean(cycle.prepared_at) ||
    ["PREPARED", "CHECKED", "COLLECTED", "DELIVERED", "COMPLETED"].includes(
      cycle.status,
    ) ||
    cycle.stock_deducted
  );
}

function isCycleChecked(cycle: DosetteCycle): boolean {
  return (
    Boolean(cycle.checked_at) ||
    ["CHECKED", "COLLECTED", "DELIVERED", "COMPLETED"].includes(cycle.status) ||
    cycle.stock_deducted
  );
}

function cycleStageLabel(
  cycle: DosetteCycle,
  activeLineCount: number,
  hasGeneratedPickingList: boolean,
): string {
  if (cycle.status === "CANCELLED") {
    return "Cancelled";
  }
  if (cycle.status === "NEEDS_CHANGES") {
    return "Needs changes";
  }
  if (["COLLECTED", "DELIVERED", "COMPLETED"].includes(cycle.status)) {
    return statusLabel(cycle.status);
  }
  if (cycle.stock_deducted) {
    return "Stock deducted";
  }
  if (cycle.status === "CHECKED") {
    return "Checked";
  }
  if (cycle.status === "PREPARED") {
    return "Prepared";
  }
  if (hasGeneratedPickingList) {
    return "Picking list ready";
  }
  if (cycle.status === "DRAFT") {
    return activeLineCount > 0 ? "Medicines added" : "Draft";
  }

  return statusLabel(cycle.status);
}

function cycleNextStep(
  cycle: DosetteCycle,
  activeLineCount: number,
  hasGeneratedPickingList: boolean,
): string {
  if (cycle.status === "CANCELLED") {
    return "This cycle is cancelled.";
  }
  if (cycle.status === "NEEDS_CHANGES") {
    return "Review changes before continuing.";
  }
  if (cycle.status === "COMPLETED") {
    return "Completed for this cycle.";
  }
  if (["COLLECTED", "DELIVERED"].includes(cycle.status)) {
    return "This cycle is complete.";
  }
  if (cycle.stock_deducted) {
    return "Stock deducted. Record collection when available.";
  }
  if (cycle.status === "CHECKED") {
    return "Checked. Deduct stock when ready.";
  }
  if (cycle.status === "PREPARED") {
    return "Ready for pharmacist check.";
  }
  if (activeLineCount === 0) {
    return "Add medicines, then generate a picking list.";
  }
  if (hasGeneratedPickingList) {
    return "Prepare the tray, then mark as prepared.";
  }

  return "Generate the picking list before preparing.";
}

function buildCycleChecklist(
  cycle: DosetteCycle,
  activeLineCount: number,
  hasGeneratedPickingList: boolean,
): CycleChecklistStep[] {
  const pickingListDone =
    hasGeneratedPickingList ||
    isCyclePrepared(cycle) ||
    isCycleChecked(cycle) ||
    cycle.stock_deducted;
  const completion = [
    activeLineCount > 0,
    pickingListDone,
    isCyclePrepared(cycle),
    isCycleChecked(cycle),
    cycle.stock_deducted,
  ];
  const firstPending = completion.findIndex((done) => !done);

  return [
    "Medicines",
    "Picking list",
    "Prepared",
    "Checked",
    "Stock deducted",
  ].map((label, index) => ({
    key: label.toLowerCase().replaceAll(" ", "-"),
    label,
    state: completion[index]
      ? "done"
      : firstPending === index
        ? "current"
        : "pending",
  }));
}

function checklistStateLabel(state: ChecklistState): string {
  if (state === "done") {
    return "Done";
  }
  if (state === "current") {
    return "Current";
  }

  return "Pending";
}

const SLOT_META = [
  {
    key: "quantity_morning",
    label: "Morning",
    short: "AM",
    Icon: Sunrise,
    tone: {
      accent: "border-amber-200 bg-amber-50 text-amber-800",
      cell: "bg-amber-50/35 hover:bg-amber-50/70",
      empty: "border-amber-200 bg-amber-50/70 text-amber-800",
      selected:
        "bg-gradient-to-br from-amber-50 to-white ring-2 ring-amber-300 ring-offset-0",
    },
  },
  {
    key: "quantity_lunchtime",
    label: "Lunchtime",
    short: "Lunch",
    Icon: Sun,
    tone: {
      accent: "border-sky-200 bg-sky-50 text-sky-800",
      cell: "bg-sky-50/35 hover:bg-sky-50/70",
      empty: "border-sky-200 bg-sky-50/70 text-sky-800",
      selected:
        "bg-gradient-to-br from-sky-50 to-white ring-2 ring-sky-300 ring-offset-0",
    },
  },
  {
    key: "quantity_evening",
    label: "Evening",
    short: "PM",
    Icon: Sunset,
    tone: {
      accent: "border-indigo-200 bg-indigo-50 text-indigo-800",
      cell: "bg-indigo-50/35 hover:bg-indigo-50/70",
      empty: "border-indigo-200 bg-indigo-50/70 text-indigo-800",
      selected:
        "bg-gradient-to-br from-indigo-50 to-white ring-2 ring-indigo-300 ring-offset-0",
    },
  },
  {
    key: "quantity_bedtime",
    label: "Bedtime",
    short: "Night",
    Icon: Moon,
    tone: {
      accent: "border-slate-300 bg-slate-100 text-slate-800",
      cell: "bg-slate-50/80 hover:bg-slate-100",
      empty: "border-slate-300 bg-slate-100/80 text-slate-800",
      selected:
        "bg-gradient-to-br from-slate-100 to-white ring-2 ring-slate-400 ring-offset-0",
    },
  },
] as const;

type DoseSlot = (typeof SLOT_META)[number];
type DoseSlotKey = DoseSlot["key"];

const TRAY_DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const TRAY_MEDICINE_FORM_ID = "tray-medicine-editor-form";
const COLLECTION_BLOCKED_MESSAGE =
  "Collection can be recorded after the four-week period has been checked and stock deducted.";

function todayIsoDate(): string {
  return toIsoDate(new Date());
}

function periodStatusTone(status: string): StatusTone {
  switch (status) {
    case "SUBMITTED":
      return "brand";
    case "COLLECTED":
      return "success";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

function periodDateRange(
  value: Pick<DosettePeriod | DosettePeriodCycle, "start_date" | "end_date">,
): string {
  return `${formatDate(value.start_date)} - ${formatDate(value.end_date)}`;
}

function periodWeekLabel(cycle: DosettePeriodCycle, index: number): string {
  return `Week ${cycle.week_number ?? index + 1}`;
}

function validationMessages(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function periodActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && isRecord(error.data)) {
    const detailMessages = validationMessages(error.data.detail);

    if (
      detailMessages.some((message) =>
        message.includes("All four cycles must be checked and stock deducted"),
      )
    ) {
      return COLLECTION_BLOCKED_MESSAGE;
    }

    const collectedOnMessages = validationMessages(error.data.collected_on);
    if (collectedOnMessages.length > 0) {
      return collectedOnMessages[0];
    }

    if (detailMessages.length > 0) {
      return detailMessages[0];
    }
  }

  return fallback;
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

function CycleStatusOverview({
  activeLineCount,
  cycle,
  hasGeneratedPickingList,
}: {
  activeLineCount: number;
  cycle: DosetteCycle;
  hasGeneratedPickingList: boolean;
}) {
  const stageLabel = cycleStageLabel(
    cycle,
    activeLineCount,
    hasGeneratedPickingList,
  );
  const nextStep = cycleNextStep(cycle, activeLineCount, hasGeneratedPickingList);
  const checklist = buildCycleChecklist(
    cycle,
    activeLineCount,
    hasGeneratedPickingList,
  );
  const completedSteps = checklist.filter((step) => step.state === "done").length;
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
            <Badge dot variant={isFlagged ? "danger" : cycleStatusTone(cycle.status)}>
              Current stage
            </Badge>
            <Badge dot variant={dueStatusTone(cycle.due_status)}>
              {dueStatusLabel(cycle.due_status)}
            </Badge>
            {hasGeneratedPickingList ? (
              <Badge icon={<ClipboardList className="h-3 w-3" />} variant="info">
                Picking list generated
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-extrabold text-ink">{stageLabel}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
            {nextStep}
          </p>
          {cycle.is_due_soon ? (
            <p className="mt-2 text-xs font-semibold text-warning-ink">
              Review before preparation. Human review required.
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:w-[26rem]">
          <div className="rounded-xl border border-line bg-surface-subtle p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Preparation progress
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink">
              <span className="tnum">{completedSteps}</span> of{" "}
              <span className="tnum">{checklist.length}</span> steps complete
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface-subtle p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Stock action
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink">
              {cycle.stock_deducted ? "Stock deducted" : "Not deducted"}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface-subtle p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Pharmacist check
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink">
              {isCycleChecked(cycle)
                ? "Checked"
                : cycle.status === "PREPARED"
                  ? "Ready for check"
                  : "Pending"}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface-subtle p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
              Open schedule
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink">
              {cycleSupplyPeriodLabel(cycle)}
            </p>
          </div>
        </div>
      </div>

      <ol
        aria-label="Dosette preparation checklist"
        className="mt-5 grid gap-2 sm:grid-cols-5"
      >
        {checklist.map((step, index) => (
          <li
            className={cn(
              "rounded-xl border px-3 py-3",
              step.state === "done" &&
                "border-success-border bg-success-soft text-success-ink",
              step.state === "current" &&
                "border-brand/25 bg-brand-soft/70 text-brand-ink",
              step.state === "pending" &&
                "border-line bg-surface-subtle text-ink-soft",
            )}
            key={step.key}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-extrabold",
                  step.state === "done" &&
                    "border-success bg-success text-white",
                  step.state === "current" &&
                    "border-brand bg-brand text-white",
                  step.state === "pending" &&
                    "border-line-strong bg-surface text-muted",
                )}
              >
                {step.state === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold">{step.label}</span>
                <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-[0.06em] opacity-75">
                  {checklistStateLabel(step.state)}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DosettePeriodStatusPanel({
  actionError,
  activeLineCount,
  canManage,
  collectionDate,
  isCollecting,
  isSubmitting,
  latestPeriod,
  onCollect,
  onCollectionDateChange,
  onSubmit,
  openPeriod,
}: {
  actionError: string | null;
  activeLineCount: number;
  canManage: boolean;
  collectionDate: string;
  isCollecting: boolean;
  isSubmitting: boolean;
  latestPeriod: DosettePeriod | null;
  onCollect: () => void;
  onCollectionDateChange: (value: string) => void;
  onSubmit: () => void;
  openPeriod: DosettePeriod | null;
}) {
  const today = todayIsoDate();
  const collectionDateIsFuture = collectionDate > today;
  const hasOpenPeriod = openPeriod !== null;
  const period = openPeriod ?? latestPeriod;
  const headline = hasOpenPeriod
    ? "Four-week period in progress"
    : latestPeriod?.status === "COLLECTED"
      ? "Last four-week period collected"
      : "Ready for medication schedule review";
  const summary = hasOpenPeriod
    ? "Review before preparation, then record Patient Collected after the four weekly cycles are checked and stock deducted."
    : activeLineCount > 0
      ? "Submit medication schedule to create one four-week period and four weekly cycles for human review."
      : "Add at least one active medication before submitting the medication schedule.";

  return (
    <section
      aria-label="Dosette period workflow"
      className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge dot variant={period ? periodStatusTone(period.status) : "info"}>
              Four-week period
            </Badge>
            {period ? (
              <Badge dot variant={periodStatusTone(period.status)}>
                {statusLabel(period.status)}
              </Badge>
            ) : (
              <Badge dot variant="neutral">Not submitted</Badge>
            )}
          </div>
          <h2 className="mt-3 text-xl font-extrabold text-ink">{headline}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
            {summary}
          </p>
          {period ? (
            <p className="mt-2 tnum text-xs font-semibold text-muted">
              {periodDateRange(period)}
            </p>
          ) : null}
        </div>

        {canManage ? (
          <div className="flex w-full flex-col gap-3 xl:w-[25rem]">
            {!hasOpenPeriod ? (
              <Button
                disabled={isSubmitting || activeLineCount === 0}
                leadingIcon={<CalendarRange className="h-4 w-4" />}
                onClick={onSubmit}
                variant="primary"
              >
                {isSubmitting ? "Submitting..." : "Submit medication schedule"}
              </Button>
            ) : (
              <div className="rounded-xl border border-line bg-surface-subtle p-3">
                <label className={labelClass}>
                  Collection date
                  <input
                    className={`${inputClass} tnum`}
                    max={today}
                    onChange={(event) =>
                      onCollectionDateChange(event.currentTarget.value)
                    }
                    type="date"
                    value={collectionDate}
                  />
                </label>
                {collectionDateIsFuture ? (
                  <p className="mt-2 text-xs font-semibold text-danger-ink">
                    Collection date cannot be in the future.
                  </p>
                ) : null}
                <Button
                  className="mt-3"
                  disabled={isCollecting || collectionDateIsFuture}
                  fullWidth
                  leadingIcon={<PackageCheck className="h-4 w-4" />}
                  onClick={onCollect}
                  variant="primary"
                >
                  {isCollecting ? "Recording..." : "Patient Collected"}
                </Button>
              </div>
            )}
            {actionError ? (
              <div
                className="rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-ink"
                role="alert"
              >
                {actionError}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FourWeekPeriodSummary({
  period,
}: {
  period: DosettePeriod | null;
}) {
  return (
    <Panel>
      <PanelHeader
        icon={<CalendarRange className="h-4 w-4" />}
        title="Four-week cycles"
        subtitle="Period summary for the submitted medication schedule."
      />
      <PanelBody>
        {!period ? (
          <EmptyState
            icon={<CalendarRange className="h-5 w-5" />}
            title="No four-week period submitted."
            description="Submit medication schedule when the tray has been reviewed."
          />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-line bg-surface-subtle p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge dot variant={periodStatusTone(period.status)}>
                    {statusLabel(period.status)}
                  </Badge>
                  <Badge variant="info">Four-week period</Badge>
                </div>
                <h3 className="mt-3 text-base font-extrabold text-ink">
                  {periodDateRange(period)}
                </h3>
                <p className="mt-1 text-xs font-semibold text-muted">
                  Review before preparation. Human review required.
                </p>
              </div>

              <div className="rounded-xl border border-line bg-surface-subtle p-4">
                <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <CycleDetailValue
                    label="Collected on"
                    value={optionalDate(period.collected_on)}
                  />
                  <CycleDetailValue
                    label="Next due"
                    value={optionalDate(period.next_due_date)}
                  />
                  <CycleDetailValue
                    label="Prepare reminder"
                    value={optionalDate(period.reminder_date)}
                  />
                </dl>
                {period.collected_on ? (
                  <p className="mt-3 text-xs font-semibold text-ink-soft">
                    Work Queue reminder appears seven days before the next due date.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {period.cycles.map((cycle, index) => {
                const label = periodWeekLabel(cycle, index);
                return (
                  <article
                    aria-label={`${label} cycle`}
                    className="rounded-xl border border-line bg-surface p-3"
                    key={cycle.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-extrabold text-ink">{label}</h4>
                      <MedicationStatusBadge value={cycle.status} />
                    </div>
                    <p className="mt-2 tnum text-sm font-semibold text-ink-soft">
                      {periodDateRange(cycle)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {cycle.stock_deducted ? "Stock deducted" : "Stock not deducted"}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
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
            Predicted dates only. Human review required before any future period is
            submitted.
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

function FieldErrorList({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <ul className={fieldErrorClass}>
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

function toQuantity(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function doseQuantityLabel(line: Pick<PatientMedicationLine, "form">, quantity: number): string {
  const form = line.form?.trim().toLowerCase();
  if (!form || form === "not recorded") {
    return String(quantity);
  }

  const unit = quantity === 1 || form.endsWith("s") ? form : `${form}s`;
  return `${quantity} ${unit}`;
}

function productPackLabel(product: CatalogueProduct): string {
  if (product.pack_size === null) {
    return "Not specified";
  }
  return `${product.pack_size}${product.pack_unit ? ` ${product.pack_unit}` : ""}`;
}

function medicationSlotLines(
  lines: PatientMedicationLine[],
  slot: DoseSlot,
): PatientMedicationLine[] {
  return lines.filter((line) => line.is_active && line[slot.key] > 0);
}

function medicationSlotQuantities(
  line: PatientMedicationLine | null,
): Record<DoseSlotKey, number> {
  return {
    quantity_morning: line?.quantity_morning ?? 0,
    quantity_lunchtime: line?.quantity_lunchtime ?? 0,
    quantity_evening: line?.quantity_evening ?? 0,
    quantity_bedtime: line?.quantity_bedtime ?? 0,
  };
}

const MAX_VISIBLE_TRAY_MEDICINES = 6;
const TRAY_POPOVER_WIDTH = 224;
const TRAY_POPOVER_MIN_WIDTH = 160;
const TRAY_POPOVER_MARGIN = 12;
const TRAY_POPOVER_OFFSET = 8;
const TRAY_POPOVER_FALLBACK_HEIGHT = 132;

interface TrayPopoverPosition {
  left: number;
  placement: "bottom" | "top";
  top: number;
  width: number;
}

function clampValue(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function sameTrayPopoverPosition(
  left: TrayPopoverPosition | null,
  right: TrayPopoverPosition,
): boolean {
  return (
    left?.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.placement === right.placement
  );
}

function trayPopoverPosition(
  anchorRect: DOMRect,
  popoverHeight = TRAY_POPOVER_FALLBACK_HEIGHT,
): TrayPopoverPosition {
  const viewportWidth =
    typeof window === "undefined" ? TRAY_POPOVER_WIDTH : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 768 : window.innerHeight;
  const width = Math.min(
    TRAY_POPOVER_WIDTH,
    Math.max(TRAY_POPOVER_MIN_WIDTH, viewportWidth - TRAY_POPOVER_MARGIN * 2),
  );
  const maxLeft = Math.max(
    TRAY_POPOVER_MARGIN,
    viewportWidth - TRAY_POPOVER_MARGIN - width,
  );
  const left = clampValue(
    anchorRect.left + anchorRect.width / 2 - width / 2,
    TRAY_POPOVER_MARGIN,
    maxLeft,
  );
  const belowSpace = viewportHeight - anchorRect.bottom - TRAY_POPOVER_MARGIN;
  const aboveSpace = anchorRect.top - TRAY_POPOVER_MARGIN;
  const placement =
    belowSpace < popoverHeight + TRAY_POPOVER_OFFSET && aboveSpace > belowSpace
      ? "top"
      : "bottom";
  const rawTop =
    placement === "top"
      ? anchorRect.top - TRAY_POPOVER_OFFSET - popoverHeight
      : anchorRect.bottom + TRAY_POPOVER_OFFSET;
  const maxTop = Math.max(
    TRAY_POPOVER_MARGIN,
    viewportHeight - TRAY_POPOVER_MARGIN - popoverHeight,
  );
  const top = clampValue(rawTop, TRAY_POPOVER_MARGIN, maxTop);

  return {
    left: Math.round(left),
    placement,
    top: Math.round(top),
    width: Math.round(width),
  };
}

function stableMedicineHash(line: PatientMedicationLine, slot: DoseSlot): number {
  const key = `${line.id}-${line.medication_name}-${slot.key}`;
  return Array.from(key).reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) % 997,
    7,
  );
}

function medicineInitial(line: PatientMedicationLine): string {
  return line.medication_name.trim().charAt(0).toUpperCase() || "M";
}

function medicineParticleShapeClass(shape: string | undefined): string {
  const normalised = shape?.trim().toLowerCase() ?? "";
  if (/capsule/.test(normalised)) {
    return "h-7 w-12 rounded-full";
  }
  if (/caplet/.test(normalised)) {
    return "h-7 w-12 rounded-[1rem]";
  }
  if (/(oval|oblong)/.test(normalised)) {
    return "h-7 w-11 rounded-full";
  }
  if (/small/.test(normalised)) {
    return "h-7 w-7 rounded-full";
  }
  if (/round/.test(normalised)) {
    return "h-9 w-9 rounded-full";
  }

  return "h-8 w-8 rounded-full";
}

function medicineParticleOffset(line: PatientMedicationLine, slot: DoseSlot): string {
  const options = [
    "rotate-0 translate-y-0",
    "-rotate-6 -translate-y-0.5",
    "rotate-6 translate-y-0.5",
    "-rotate-3 translate-x-0.5",
    "rotate-3 -translate-x-0.5",
  ];
  return options[stableMedicineHash(line, slot) % options.length];
}

function TrayMedicationParticle({
  day,
  isActive,
  line,
  onHideDetails,
  onShowDetails,
  quantity,
  slot,
}: {
  day: string;
  isActive: boolean;
  line: PatientMedicationLine;
  onHideDetails: () => void;
  onShowDetails: () => void;
  quantity: number;
  slot: DoseSlot;
}) {
  const shape = line.shape ?? undefined;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const detailCardRef = useRef<HTMLDivElement | null>(null);
  const [popoverPosition, setPopoverPosition] =
    useState<TrayPopoverPosition | null>(null);
  const detailId = `tray-medicine-detail-${day.toLowerCase()}-${slot.key}-${line.id}`;
  const updatePopoverPosition = useCallback((height?: number) => {
    const anchor = buttonRef.current;
    if (!anchor || typeof window === "undefined") {
      return;
    }
    const measuredHeight =
      height ??
      detailCardRef.current?.getBoundingClientRect().height ??
      TRAY_POPOVER_FALLBACK_HEIGHT;
    const nextPosition = trayPopoverPosition(
      anchor.getBoundingClientRect(),
      measuredHeight || TRAY_POPOVER_FALLBACK_HEIGHT,
    );
    setPopoverPosition((currentPosition) =>
      sameTrayPopoverPosition(currentPosition, nextPosition)
        ? currentPosition
        : nextPosition,
    );
  }, []);
  const setDetailCardElement = useCallback(
    (element: HTMLDivElement | null) => {
      detailCardRef.current = element;
      if (element && isActive) {
        updatePopoverPosition(
          element.getBoundingClientRect().height || TRAY_POPOVER_FALLBACK_HEIGHT,
        );
      }
    },
    [isActive, updatePopoverPosition],
  );

  useLayoutEffect(() => {
    if (!isActive) {
      setPopoverPosition(null);
      return;
    }

    updatePopoverPosition();
  }, [isActive, updatePopoverPosition]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    const reposition = () => updatePopoverPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isActive, updatePopoverPosition]);

  useEffect(() => {
    if (!isActive || typeof document === "undefined") {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onHideDetails();
      }
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        buttonRef.current?.contains(target) ||
        detailCardRef.current?.contains(target)
      ) {
        return;
      }
      onHideDetails();
    };

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [isActive, onHideDetails]);

  return (
    <span
      className="inline-grid place-items-center"
      onMouseEnter={onShowDetails}
      onMouseLeave={onHideDetails}
    >
      <button
        aria-label={`Show ${line.medication_name} details for ${day} ${slot.label}, ${doseQuantityLabel(
          line,
          quantity,
        )}`}
        aria-describedby={isActive ? detailId : undefined}
        aria-expanded={isActive}
        className="pointer-events-auto relative z-20 grid min-h-14 min-w-12 place-items-center rounded-xl px-1 py-1.5 text-center transition-transform duration-150 ease-soft hover:-translate-y-0.5 focus-ring focus:-translate-y-0.5"
        onBlur={onHideDetails}
        onClick={(event) => {
          event.stopPropagation();
          onShowDetails();
        }}
        onFocus={onShowDetails}
        ref={buttonRef}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid place-items-center border border-line-strong text-[11px] font-extrabold text-ink shadow-[inset_0_1px_2px_rgba(255,255,255,0.85),0_6px_14px_rgba(42,35,64,0.12)]",
            medicineParticleShapeClass(shape),
            medicineParticleOffset(line, slot),
          )}
          style={{ backgroundColor: appearanceColour(line.colour ?? undefined) }}
        >
          {medicineInitial(line)}
        </span>
        <span className="mt-1 max-w-16 truncate rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-soft shadow-sm">
          {doseQuantityLabel(line, quantity)}
        </span>
      </button>
      {isActive && popoverPosition && typeof document !== "undefined"
        ? createPortal(
            <TrayMedicationDetailCard
              cardRef={setDetailCardElement}
              id={detailId}
              line={line}
              position={popoverPosition}
              quantity={quantity}
              slot={slot}
            />,
            document.body,
          )
        : null}
    </span>
  );
}

function TrayMedicationDetailCard({
  cardRef,
  id,
  line,
  position,
  quantity,
  slot,
}: {
  cardRef: (element: HTMLDivElement | null) => void;
  id: string;
  line: PatientMedicationLine;
  position: TrayPopoverPosition;
  quantity: number;
  slot: DoseSlot;
}) {
  return (
    <div
      aria-label={`${line.medication_name} details`}
      className="pointer-events-none fixed z-[80] w-56 max-w-xs rounded-lg border border-line bg-white/95 p-2 text-left shadow-elev-2 backdrop-blur"
      data-placement={position.placement}
      id={id}
      ref={cardRef}
      role="status"
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
      }}
    >
      <p className="truncate text-xs font-extrabold text-ink">
        {line.medication_name}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">
        {strengthFormLabel(line)}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="brand">{doseQuantityLabel(line, quantity)}</Badge>
        <Badge variant="neutral">{slot.label}</Badge>
      </div>
      <p className="mt-2 truncate text-[11px] font-semibold text-muted">
        {appearanceLabel(line)}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-ink-soft">
        {statusLabel(line.is_active)}
      </p>
    </div>
  );
}

function TrayCell({
  canInteract,
  canManage,
  day,
  isSelected,
  lines,
  onSelect,
  slot,
}: {
  canInteract: boolean;
  canManage: boolean;
  day: string;
  isSelected: boolean;
  lines: PatientMedicationLine[];
  onSelect: (day: string, slot: DoseSlot) => void;
  slot: DoseSlot;
}) {
  const medicines = medicationSlotLines(lines, slot);
  const visibleMedicines = medicines.slice(0, MAX_VISIBLE_TRAY_MEDICINES);
  const hiddenMedicineCount = Math.max(0, medicines.length - visibleMedicines.length);
  const [activeMedicineId, setActiveMedicineId] = useState<number | null>(null);
  const activeMedicine =
    medicines.find((line) => line.id === activeMedicineId) ?? null;
  const content = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]",
            slot.tone.accent,
          )}
        >
          {slot.short}
        </span>
        {canInteract ? (
          <button
            aria-label={`${day} ${slot.label} tray cell`}
            className="relative z-20 rounded-full px-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand transition-colors duration-150 ease-soft hover:text-brand-hover focus-ring"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(day, slot);
            }}
            type="button"
          >
            {canManage
              ? medicines.length > 0
                ? "Edit medicine"
                : "Add medicine"
              : "Open schedule"}
          </button>
        ) : null}
      </span>
      {medicines.length === 0 ? (
        <span
          className={cn(
            "mt-4 grid min-h-24 place-items-center rounded-xl border border-dashed px-2 py-4 text-center text-xs font-bold",
            slot.tone.empty,
          )}
        >
          <span>
            <span className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full border border-current/25 bg-white/70">
              <Plus aria-hidden="true" className="h-4 w-4" />
            </span>
            Add medicine
          </span>
        </span>
      ) : (
        <span
          aria-label={`${day} ${slot.label} medicines`}
          className="mt-3 grid min-h-28 grid-cols-3 content-center justify-items-center gap-2 rounded-xl border border-white/70 bg-white/45 px-2 py-3 shadow-inner"
        >
          {visibleMedicines.map((line) => (
            <TrayMedicationParticle
              day={day}
              isActive={activeMedicineId === line.id}
              key={`${day}-${slot.key}-${line.id}`}
              line={line}
              onHideDetails={() => setActiveMedicineId(null)}
              onShowDetails={() => setActiveMedicineId(line.id)}
              quantity={line[slot.key]}
              slot={slot}
            />
          ))}
          {hiddenMedicineCount > 0 ? (
            <span className="grid h-10 w-10 place-items-center rounded-full border border-line-strong bg-surface text-xs font-extrabold text-ink shadow-elev-1">
              +{hiddenMedicineCount}
            </span>
          ) : null}
        </span>
      )}
    </>
  );
  const className = cn(
    "group relative min-h-[10rem] w-full overflow-visible border-l border-t border-line p-2 text-left transition-[background-color,box-shadow,transform] duration-150 ease-soft",
    slot.tone.cell,
    canInteract && "cursor-pointer hover:shadow-inner",
    isSelected && slot.tone.selected,
    activeMedicine && "z-30",
  );

  return (
    <div
      aria-label={!canInteract ? `${day} ${slot.label} tray cell` : undefined}
      className={className}
      onClick={canInteract ? () => onSelect(day, slot) : undefined}
    >
      <span className="relative z-10 block">{content}</span>
    </div>
  );
}

function TrayEditorLineCard({
  canManage,
  canMarkStatus,
  line,
  onDiscontinue,
  onEdit,
  onEditAppearance,
  slot,
}: {
  canManage: boolean;
  canMarkStatus: boolean;
  line: PatientMedicationLine;
  onDiscontinue: (line: PatientMedicationLine) => void;
  onEdit: (line: PatientMedicationLine) => void;
  onEditAppearance: (line: PatientMedicationLine) => void;
  slot: DoseSlot;
}) {
  const appearance = appearanceLabel(line);

  return (
    <article
      aria-label={`Medicine in ${slot.label} ${line.medication_name}`}
      className="rounded-xl border border-line bg-surface p-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <MedicationAppearanceMarker colour={line.colour} shape={line.shape} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-extrabold text-ink">
                {line.medication_name}
              </h4>
              <MedicationStatusBadge value={line.is_active} />
              <Badge variant="brand">
                {doseQuantityLabel(line, line[slot.key])}
              </Badge>
            </div>
            <p className="mt-1 text-xs font-semibold text-muted">
              {strengthFormLabel(line)}
            </p>
            <p className="mt-2 text-xs font-semibold text-muted">
              Appearance: {appearance}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted">
              Start date: {optionalDate(line.start_date)}
            </p>
          </div>
        </div>
        <Badge variant="neutral">
          <span className="tnum">{totalDaily(line)}</span>/day
        </Badge>
      </div>

      {canManage || canMarkStatus ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
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
              Edit medicine
            </Button>
          ) : null}
          {canManage ? (
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

function MdsTrayBuilder({
  canManage,
  canMarkStatus,
  lines,
  onAdvancedManualEntry,
  onDiscontinue,
  onEditAppearance,
  patientId,
}: {
  canManage: boolean;
  canMarkStatus: boolean;
  lines: PatientMedicationLine[];
  onAdvancedManualEntry: () => void;
  onDiscontinue: (line: PatientMedicationLine) => void;
  onEditAppearance: (line: PatientMedicationLine) => void;
  patientId: number;
}) {
  const createMedication = useCreatePatientMedication(patientId);
  const updateMedication = useUpdatePatientMedication(patientId);
  const { success } = useToast();
  const [selectedCell, setSelectedCell] =
    useState<{ day: string; slot: DoseSlot } | null>(null);
  const [editorMode, setEditorMode] = useState<"choose" | "form">("form");
  const [editingLine, setEditingLine] = useState<PatientMedicationLine | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CatalogueProduct | null>(
    null,
  );
  const [doseQuantity, setDoseQuantity] = useState("1");
  const [doseInstructions, setDoseInstructions] = useState("");
  const [startDate, setStartDate] = useState("");
  const [colour, setColour] = useState("");
  const [shape, setShape] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const activeLines = lines.filter((line) => line.is_active);
  const canInteract = canManage || canMarkStatus;
  const selectedSlotLines = selectedCell
    ? medicationSlotLines(activeLines, selectedCell.slot)
    : [];

  useEffect(() => {
    if (!selectedCell || editorMode !== "form") {
      setErrors({});
      return;
    }

    setSelectedProduct(null);
    setDoseInstructions(editingLine?.dose_instructions ?? "");
    setDoseQuantity(String(editingLine?.[selectedCell.slot.key] ?? 1));
    setStartDate(editingLine?.start_date ?? "");
    setColour(editingLine?.colour ?? "");
    setShape(editingLine?.shape ?? "");
    setErrors({});
  }, [editingLine, editorMode, selectedCell]);

  function openTrayCell(day: string, slot: DoseSlot) {
    const linesInSlot = medicationSlotLines(activeLines, slot);
    setSelectedCell({ day, slot });
    setEditingLine(null);
    setEditorMode(linesInSlot.length > 0 ? "choose" : "form");
  }

  function openAddAnother() {
    setEditingLine(null);
    setEditorMode("form");
  }

  function openEditLine(line: PatientMedicationLine) {
    setEditingLine(line);
    setEditorMode("form");
  }

  const closeEditor = useCallback(() => {
    setSelectedCell(null);
    setEditingLine(null);
    setEditorMode("form");
    setErrors({});
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCell) {
      return;
    }

    setErrors({});
    const nextErrors: FieldErrors = {};
    if (!editingLine && selectedProduct === null) {
      nextErrors.catalogue_product = ["Select a catalogue product."];
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const quantities = medicationSlotQuantities(editingLine);
    quantities[selectedCell.slot.key] = toQuantity(doseQuantity);
    const body: PatientMedicationWriteBody = {
      ...quantities,
      dose_instructions: doseInstructions.trim(),
      start_date: startDate || null,
      colour: colour.trim(),
      shape: shape.trim(),
    };
    if (editingLine) {
      body.medication = editingLine.medication;
    } else if (selectedProduct) {
      body.catalogue_product = selectedProduct.id;
    }

    try {
      if (editingLine) {
        await updateMedication.mutateAsync({ id: editingLine.id, body });
        success("Medication line updated", editingLine.medication_name);
      } else {
        await createMedication.mutateAsync(body);
        success("Medication line added");
      }
      closeEditor();
    } catch (error) {
      setErrors(normalizeErrors(error));
    }
  }

  const isSaving = createMedication.isPending || updateMedication.isPending;
  const isFormVisible =
    selectedCell !== null &&
    canManage &&
    (editorMode === "form" || selectedSlotLines.length === 0);
  const modalTitle = editingLine ? "Edit tray medicine" : "Add medicine to tray";

  return (
    <>
    <Panel>
      <PanelHeader
        icon={<Pill className="h-4 w-4" />}
        title="MDS tray builder"
        subtitle="Click a dose-time cell to add or update a medicine for that schedule."
        actions={
          canManage ? (
            <Button
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={onAdvancedManualEntry}
              variant="secondary"
            >
              Advanced manual entry
            </Button>
          ) : null
        }
      />
      <PanelBody>
        <div className="rounded-xl border border-line bg-surface-subtle p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-sm font-semibold leading-6 text-ink-soft">
                This tray repeats the saved dose slots across the cycle using the
                current MDS schedule model. Review before preparation.
              </p>
              <p className="mt-1 text-xs font-semibold text-muted">
                Timing will be saved as Morning/Lunchtime/Evening/Bedtime and
                repeated across the cycle.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">Saved dose slots</Badge>
              <Badge variant="warning">Human review required</Badge>
            </div>
          </div>
        </div>

        <div
          aria-label="MDS tray builder"
          className="mt-4 overflow-x-auto rounded-xl border border-line bg-white shadow-elev-1"
          role="table"
        >
          <div className="grid min-w-[74rem] grid-cols-[8rem_repeat(7,minmax(0,1fr))]">
            <div className="sticky left-0 z-20 border-b border-r border-line bg-surface-subtle p-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted shadow-[4px_0_10px_rgba(42,35,64,0.05)]">
              Dose time
            </div>
            {TRAY_DAY_LABELS.map((day) => (
              <div
                className="border-b border-l border-line bg-surface-subtle p-3 text-center text-xs font-extrabold text-ink"
                key={day}
              >
                {day}
              </div>
            ))}
            {SLOT_META.map((slot) => (
              <div className="contents" key={slot.key}>
                <div
                  className={cn(
                    "sticky left-0 z-10 border-r border-t border-line p-3 shadow-[4px_0_10px_rgba(42,35,64,0.05)]",
                    slot.tone.accent,
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-extrabold">
                    <slot.Icon aria-hidden="true" className="h-4 w-4" />
                    {slot.label}
                  </div>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] opacity-75">
                    {slot.short}
                  </p>
                </div>
                {TRAY_DAY_LABELS.map((day) => (
                  <TrayCell
                    canInteract={canInteract}
                    canManage={canManage}
                    day={day}
                    isSelected={
                      selectedCell?.day === day &&
                      selectedCell.slot.key === slot.key
                    }
                    key={`${slot.key}-${day}`}
                    lines={activeLines}
                    onSelect={openTrayCell}
                    slot={slot}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {!canInteract ? (
          <p className="mt-3 text-xs font-semibold text-muted">
            Open schedule access is view-only for this role.
          </p>
        ) : null}

      </PanelBody>
    </Panel>
    <Modal
      description={
        selectedCell
          ? `${selectedCell.day} · ${selectedCell.slot.label}`
          : undefined
      }
      isOpen={selectedCell !== null}
      onClose={closeEditor}
      size="lg"
      title={modalTitle}
    >
      {selectedCell ? (
        <div className="-m-6 flex max-h-[min(82vh,48rem)] flex-col overflow-hidden">
          <div className="border-b border-line bg-surface-subtle px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-brand">
                  Selected tray cell
                </p>
                <h3 className="mt-1 text-lg font-extrabold text-ink">
                  {selectedCell.day} · {selectedCell.slot.label}
                </h3>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  This schedule repeats across the cycle using saved dose slots.
                  Review before preparation.
                </p>
              </div>
              <Badge variant="info">Saved as {selectedCell.slot.label}</Badge>
            </div>
          </div>

          <form
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
            id={TRAY_MEDICINE_FORM_ID}
            noValidate
            onSubmit={handleSubmit}
          >
            {selectedSlotLines.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-extrabold text-ink">
                      Medicines in this dose-time
                    </h4>
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Choose a medicine to edit, or add another medicine to this
                      saved slot.
                    </p>
                  </div>
                  {canManage ? (
                    <Button onClick={openAddAnother} size="sm" variant="primary">
                      Add another medicine
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3">
                  {selectedSlotLines.map((line) => (
                    <TrayEditorLineCard
                      canManage={canManage}
                      canMarkStatus={canMarkStatus}
                      key={line.id}
                      line={line}
                      onDiscontinue={onDiscontinue}
                      onEdit={openEditLine}
                      onEditAppearance={onEditAppearance}
                      slot={selectedCell.slot}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {isFormVisible ? (
              <>
                <FieldErrorList messages={errorMessages(errors, "detail")} />
                <FieldErrorList
                  messages={errorMessages(errors, "non_field_errors")}
                />

                {editingLine ? (
                  <div
                    aria-label="Selected medication"
                    className="rounded-xl border border-line bg-surface p-4 text-sm shadow-elev-1"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-muted">
                      Editing medicine
                    </p>
                    <p className="mt-1 font-semibold text-ink">
                      {editingLine.medication_name}
                    </p>
                    <p className="mt-1 text-ink-soft">
                      {strengthFormLabel(editingLine)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <CatalogueProductSelect
                      label="Medicine"
                      onSelect={setSelectedProduct}
                      selectedProduct={selectedProduct}
                    />
                    <FieldErrorList
                      messages={errorMessages(errors, "catalogue_product")}
                    />
                    <FieldErrorList messages={errorMessages(errors, "medication")} />

                    {selectedProduct ? (
                      <div
                        aria-label="Selected catalogue product"
                        className="mt-3 rounded-xl border border-brand/20 bg-surface p-3 text-sm shadow-elev-1"
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand">
                          Selected catalogue product
                        </p>
                        <p className="mt-1 font-semibold text-brand-ink">
                          {selectedProduct.full_label}
                        </p>
                        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div>
                            <dt className="text-xs font-semibold text-muted">
                              Strength
                            </dt>
                            <dd className="mt-0.5 font-semibold text-brand-ink">
                              {selectedProduct.strength || "Not specified"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold text-muted">
                              Form
                            </dt>
                            <dd className="mt-0.5 font-semibold text-brand-ink">
                              {selectedProduct.dose_form || "Not specified"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold text-muted">
                              Pack size
                            </dt>
                            <dd className="mt-0.5 font-semibold text-brand-ink">
                              {productPackLabel(selectedProduct)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
                  <label className={labelClass}>
                    Dose instructions
                    <textarea
                      className={textareaClass}
                      onChange={(event) => setDoseInstructions(event.target.value)}
                      value={doseInstructions}
                    />
                    <FieldErrorList
                      messages={errorMessages(errors, "dose_instructions")}
                    />
                  </label>
                  <label className={labelClass}>
                    {selectedCell.slot.label} dose quantity
                    <input
                      className={`${inputClass} tnum`}
                      min={0}
                      onChange={(event) => setDoseQuantity(event.target.value)}
                      type="number"
                      value={doseQuantity}
                    />
                    <FieldErrorList
                      messages={errorMessages(errors, selectedCell.slot.key)}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className={labelClass}>
                    Colour
                    <input
                      className={inputClass}
                      onChange={(event) => setColour(event.target.value)}
                      value={colour}
                    />
                    <FieldErrorList messages={errorMessages(errors, "colour")} />
                  </label>
                  <label className={labelClass}>
                    Shape
                    <input
                      className={inputClass}
                      onChange={(event) => setShape(event.target.value)}
                      value={shape}
                    />
                    <FieldErrorList messages={errorMessages(errors, "shape")} />
                  </label>
                  <label className={labelClass}>
                    Start date
                    <input
                      className={inputClass}
                      onChange={(event) => setStartDate(event.target.value)}
                      type="date"
                      value={startDate}
                    />
                    <FieldErrorList messages={errorMessages(errors, "start_date")} />
                  </label>
                </div>
              </>
            ) : null}
          </form>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface/95 px-6 py-4 shadow-[0_-10px_24px_rgba(42,35,64,0.08)] backdrop-blur">
            <Button onClick={closeEditor} variant="secondary">
              Cancel
            </Button>
            {canManage ? (
              <Button
                disabled={!isFormVisible || isSaving}
                form={TRAY_MEDICINE_FORM_ID}
                type="submit"
                variant="primary"
              >
                {isSaving ? "Saving..." : "Save medication"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
    </>
  );
}

function PickDetail({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-subtle p-3">
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
        {label}
      </dt>
      <dd className="tnum mt-1 text-sm font-bold text-ink">{value}</dd>
      {hint ? (
        <p className="mt-1 text-[11px] font-semibold leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PickingListItemCard({ row }: { row: PickingListRow }) {
  return (
    <article
      aria-label={`Picking item ${row.medication_name}`}
      className="rounded-2xl border border-line bg-surface p-4 shadow-soft"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <Pill aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
            <span>{row.medication_name}</span>
          </h3>
          <p className="mt-1 text-xs font-semibold text-muted">
            {strengthFormLabel(row)}
          </p>
        </div>
        <Badge variant="neutral">Review before picking</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <PickDetail
          label="Required quantity"
          value={`${row.total_daily} total daily`}
          hint="From current picking data."
        />
        <PickDetail
          label="Stock check"
          value="See availability"
          hint="Review batches and shortages below."
        />
      </dl>
    </article>
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
  const itemCount = pickingList.medications.length;
  const totalCurrentQuantity = pickingList.totals.total_daily;

  return (
    <section
      aria-label="Picking list"
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft animate-fade-in-up"
    >
      <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
          >
            <ClipboardList className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              {pickingList.patient_reference}
            </p>
            <h2 className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
              Picking list: {cycle ? cycleFriendlyLabel(cycle) : internalReference}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
              Use this list to gather stock for the selected Dosette cycle.
              Review before preparation.
            </p>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <PickDetail label="Items to pick" value={itemCount} />
          <PickDetail
            label="Quantity from current picking data"
            value={totalCurrentQuantity}
            hint="Existing picking-list total."
          />
          <PickDetail
            label="Selected cycle"
            value={cycle ? cycleSupplyPeriodLabel(cycle) : internalReference}
            hint={
              cycle
                ? `${cycleDateRange(cycle)} · ${internalReference}`
                : "Cycle reference"
            }
          />
        </dl>
      </div>
      {pickingList.medications.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No items to pick for this cycle."
            description="Add an active medication line to build a picking list."
          />
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:p-5">
          {pickingList.medications.map((row) => (
            <PickingListItemCard key={row.medication_id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

const PRINT_DISCLAIMER =
  "Pharmacy Dosette preparation support. Human review required.";

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

const PRINT_DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const PRINT_SLOT_ROWS = [
  { key: "quantity_morning", label: "Morning" },
  { key: "quantity_lunchtime", label: "Lunchtime" },
  { key: "quantity_evening", label: "Evening" },
  { key: "quantity_bedtime", label: "Bedtime" },
] as const;

function printDoseLabel(line: PatientMedicationLine, quantity: number): string {
  const form = line.form?.trim().toLowerCase();
  if (!form || form === "not recorded") {
    return String(quantity);
  }

  const unit = quantity === 1 || form.endsWith("s") ? form : `${form}s`;
  return `${quantity} ${unit}`;
}

function printMedicineLabel(line: PatientMedicationLine): string {
  const strength = line.strength?.trim();
  return strength ? `${line.medication_name} ${strength}` : line.medication_name;
}

function printAppearanceLabel(line: PatientMedicationLine): string | null {
  const appearance = [line.colour, line.shape]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");

  return appearance || null;
}

function PrintTrayCell({
  day,
  lines,
  slot,
}: {
  day: string;
  lines: PatientMedicationLine[];
  slot: (typeof PRINT_SLOT_ROWS)[number];
}) {
  const medicines = lines.filter((line) => line[slot.key] > 0);

  return (
    <div
      aria-label={`${day} ${slot.label}`}
      className="dosette-print-cell min-h-[7.25rem] border-l border-t border-line bg-white p-2"
    >
      {medicines.length === 0 ? (
        <span className="dosette-print-empty tnum text-sm font-semibold text-muted">
          -
        </span>
      ) : (
        <ul className="space-y-1.5">
          {medicines.map((line) => {
            const appearance = printAppearanceLabel(line);
            const quantity = line[slot.key];
            return (
              <li
                aria-label={`${printMedicineLabel(line)} ${day} ${slot.label}`}
                className="dosette-print-item rounded-lg border border-line bg-surface-subtle px-2 py-1.5"
                key={`${day}-${slot.key}-${line.id}`}
              >
                <p className="text-[11px] font-extrabold leading-snug text-ink">
                  {printMedicineLabel(line)}
                </p>
                <p className="tnum mt-0.5 text-[11px] font-bold leading-snug text-ink-soft">
                  {printDoseLabel(line, quantity)}
                </p>
                {appearance ? (
                  <p className="mt-0.5 text-[10px] font-semibold leading-snug text-muted">
                    {appearance}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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
      aria-label="Dosette tray sheet"
      className="dosette-print-sheet rounded-2xl border border-line bg-white p-5 text-ink shadow-soft"
    >
      <header className="dosette-print-header flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted">
            Dosette tray sheet
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-ink">
            {cycleDateRange(cycle)}
          </h2>
          <p className="mt-1 text-xs font-semibold text-ink-soft">
            {pharmacyName}
          </p>
        </div>
        <dl className="dosette-print-identifiers grid gap-2 text-right sm:grid-cols-3">
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
              Patient ID
            </dt>
            <dd className="tnum mt-0.5 text-sm font-bold text-ink">
              {patientReference}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
              Cycle ref
            </dt>
            <dd className="tnum mt-0.5 text-sm font-bold text-ink">
              {cycle.reference}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
              Status
            </dt>
            <dd className="mt-0.5 text-sm font-bold text-ink">
              {statusLabel(cycle.status)}
            </dd>
          </div>
        </dl>
      </header>

      <div
        aria-label="Weekly Dosette tray grid"
        className="dosette-print-tray mt-4 overflow-hidden rounded-xl border border-line bg-white"
        role="table"
      >
        <div className="dosette-print-grid grid grid-cols-[7.5rem_repeat(7,minmax(0,1fr))]">
          <div className="border-b border-line bg-surface-subtle p-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
            Dose time
          </div>
          {PRINT_DAY_LABELS.map((day) => (
            <div
              className="border-b border-l border-line bg-surface-subtle p-2 text-center text-[11px] font-extrabold text-ink"
              key={day}
            >
              {day}
            </div>
          ))}
          {PRINT_SLOT_ROWS.map((slot) => (
            <div className="contents" key={slot.key}>
              <div className="border-t border-line bg-surface-subtle p-2 text-sm font-extrabold text-ink">
                {slot.label}
              </div>
              {PRINT_DAY_LABELS.map((day) => (
                <PrintTrayCell
                  day={day}
                  key={`${slot.key}-${day}`}
                  lines={medicationLines}
                  slot={slot}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <footer className="dosette-print-footer mt-3 flex flex-col gap-1 border-t border-line pt-2 text-[10px] font-semibold leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>{PRINT_DISCLAIMER}</span>
        <span className="tnum">Printed {formatDateTime(printedAt)}</span>
      </footer>
    </section>
  );
}

function StockAvailabilityBadge({ inStock }: { inStock: boolean }) {
  return inStock ? (
    <Badge dot variant="success">
      Stock available
    </Badge>
  ) : (
    <Badge dot variant="warning">
      Short
    </Badge>
  );
}

function StockPreviewLineCard({ row }: { row: StockPreviewRow }) {
  return (
    <article
      aria-label={`Stock availability ${row.medication_name}`}
      className="rounded-2xl border border-line bg-surface p-4 shadow-soft"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-ink">{row.medication_name}</h3>
          <p className="mt-1 text-xs font-semibold text-muted">
            {strengthFormLabel(row)}
          </p>
        </div>
        <StockAvailabilityBadge inStock={row.in_stock} />
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-4">
        <PickDetail label="Required quantity" value={row.required_quantity} />
        <PickDetail label="Available quantity" value={row.available_quantity} />
        <PickDetail
          label="Short / needs review"
          value={row.shortage_quantity}
          hint={
            row.shortage_quantity > 0
              ? "Review before picking."
              : "No shortage shown."
          }
        />
        <PickDetail
          label="Earliest expiry"
          value={row.earliest_expiry ? formatDate(row.earliest_expiry) : "Not shown"}
        />
      </dl>
      <div
        className={cn(
          "mt-4 rounded-xl border p-3",
          row.shortage_quantity > 0
            ? "border-warning-border bg-warning-soft/60"
            : "border-line bg-surface-subtle",
        )}
      >
        <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
          Suggested batch/expiry
        </p>
        {row.suggested_batches.length === 0 ? (
          <p className="mt-1 text-sm font-semibold text-ink-soft">
            No batch suggestion available.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {row.suggested_batches.map((batch) => (
              <li
                key={batch.batch_id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                <span className="font-semibold text-ink">
                  {batch.batch_number}
                </span>
                <span className="tnum text-muted">
                  {formatDate(batch.expiry_date)} - pick {batch.quantity_to_pick}
                </span>
                <span className="tnum text-muted">
                  {batch.quantity_available} available
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function StockPreviewSection({ stockPreview }: { stockPreview: StockPreview }) {
  const hasShortage = stockPreview.totals.shortage > 0;
  const availableCount = stockPreview.medications.filter((row) => row.in_stock).length;
  const shortageCount = stockPreview.medications.filter(
    (row) => row.shortage_quantity > 0,
  ).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft animate-fade-in-up">
      <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
              <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
                Check available quantity, shortages, and suggested batch expiry
                before gathering stock.
              </p>
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
        <dl className="grid gap-3 sm:grid-cols-4">
          <PickDetail label="Available" value={availableCount} />
          <PickDetail label="Short / needs review" value={shortageCount} />
          <PickDetail
            label="Required quantity"
            value={stockPreview.totals.required}
          />
          <PickDetail
            label="Available quantity"
            value={stockPreview.totals.available}
          />
        </dl>
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
        <div className="grid gap-3 p-4 sm:p-5">
          {stockPreview.medications.map((row) => (
            <StockPreviewLineCard key={row.medication_id} row={row} />
          ))}
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
  const [periodActionError, setPeriodActionError] = useState<string | null>(null);
  const [collectionDate, setCollectionDate] = useState(todayIsoDate());
  const medicationsQuery = usePatientMedicationsQuery(parsedPatientId);
  const cyclesQuery = useDosetteCyclesQuery(parsedPatientId);
  const periodsQuery = useDosettePeriodsQuery(parsedPatientId);
  const pickingListQuery = usePickingListQuery(parsedPatientId, generatedCycleId);
  const stockPreviewQuery = useStockPreviewQuery(parsedPatientId, generatedCycleId);
  const discontinueMedication =
    useDiscontinuePatientMedication(parsedPatientId);
  const submitPeriod = useSubmitDosettePeriod(parsedPatientId);
  const collectPeriod = useMarkDosettePeriodCollected(parsedPatientId);
  const prepareCycle = usePrepareDosetteCycle(parsedPatientId);
  const deductCycle = useDeductDosetteStock(parsedPatientId);
  const cancelCycle = useCancelDosetteCycle(parsedPatientId);
  const updateStatus = useUpdateCycleStatus(parsedPatientId);
  const updateAppearance = useUpdateMedicationAppearance(parsedPatientId);
  const periods = periodsQuery.data ?? [];
  const openPeriod =
    periods.find((period) => period.status === "SUBMITTED") ?? null;
  const latestPeriod = openPeriod ?? periods[0] ?? null;
  const openPeriodId = openPeriod?.id ?? null;

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

  useEffect(() => {
    if (openPeriodId === null) {
      return;
    }
    setCollectionDate(todayIsoDate());
    setPeriodActionError(null);
  }, [openPeriodId]);

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

  async function handleSubmitMedicationSchedule() {
    setPeriodActionError(null);
    try {
      await submitPeriod.mutateAsync({});
      success(
        "Medication schedule submitted",
        "Four-week period created for review before preparation.",
      );
    } catch (error) {
      setPeriodActionError(
        periodActionErrorMessage(
          error,
          "Could not submit medication schedule.",
        ),
      );
    }
  }

  async function handlePatientCollected() {
    if (!openPeriod) {
      return;
    }

    setPeriodActionError(null);
    try {
      await collectPeriod.mutateAsync({
        periodId: openPeriod.id,
        body: collectionDate ? { collected_on: collectionDate } : {},
      });
      success("Patient Collected", "Next due and prepare reminder updated.");
    } catch (error) {
      setPeriodActionError(
        periodActionErrorMessage(error, COLLECTION_BLOCKED_MESSAGE),
      );
    }
  }

  function openCreateMedicationModal() {
    setEditingLine(null);
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

      {periodsQuery.isLoading ? (
        <LoadingSection text="Loading four-week periods..." />
      ) : null}
      {periodsQuery.isError ? (
        <ErrorSection
          onRetry={() => void periodsQuery.refetch()}
          title="Could not load four-week periods."
        />
      ) : null}
      {cyclesQuery.isLoading ? <LoadingSection text="Loading cycles..." /> : null}
      {cyclesQuery.isError ? (
        <ErrorSection
          onRetry={() => void cyclesQuery.refetch()}
          title="Could not load cycles."
        />
      ) : null}
      {periodsQuery.isSuccess &&
      medicationsQuery.isSuccess &&
      cyclesQuery.isSuccess ? (
        <Panel>
          <PanelHeader
            icon={<CalendarRange className="h-4 w-4" />}
            title="Dosette status"
            subtitle="Submit the medication schedule and track collection readiness."
          />
          <PanelBody className="space-y-5">
            <DosettePeriodStatusPanel
              actionError={periodActionError}
              activeLineCount={activeLineCount}
              canManage={canManage}
              collectionDate={collectionDate}
              isCollecting={collectPeriod.isPending}
              isSubmitting={submitPeriod.isPending}
              latestPeriod={latestPeriod}
              onCollect={() => {
                void handlePatientCollected();
              }}
              onCollectionDateChange={setCollectionDate}
              onSubmit={() => {
                void handleSubmitMedicationSchedule();
              }}
              openPeriod={openPeriod}
            />
            {statusCycle ? (
              <CycleStatusOverview
                activeLineCount={activeLineCount}
                cycle={statusCycle}
                hasGeneratedPickingList={
                  hasGeneratedPickingList && statusCycle.id === selectedCycleId
                }
              />
            ) : null}
          </PanelBody>
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
        <MdsTrayBuilder
          canManage={canManage}
          canMarkStatus={canMarkStatus}
          lines={medicationsQuery.data}
          onAdvancedManualEntry={openCreateMedicationModal}
          onDiscontinue={setLineToDiscontinue}
          onEditAppearance={openAppearanceModal}
          patientId={parsedPatientId}
        />
      ) : null}

      {periodsQuery.isSuccess ? (
        <FourWeekPeriodSummary period={latestPeriod} />
      ) : null}

      {cyclesQuery.isSuccess ? (
        <Panel>
          <PanelHeader
            icon={<ClipboardList className="h-4 w-4" />}
            title="Advanced cycle tools"
            subtitle="Use these controls for preparation, checking, stock deduction, and exceptional manual cycle maintenance."
            actions={
              canManage ? (
                <Button
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={openCreateCycleModal}
                  size="sm"
                  variant="subtle"
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
                    ? "Submit medication schedule to create the four weekly cycles."
                    : "Four weekly cycles will appear after the medication schedule is submitted."
                }
                action={
                  canManage ? (
                    <Button
                      leadingIcon={<Plus className="h-4 w-4" />}
                      onClick={openCreateCycleModal}
                      size="sm"
                      variant="subtle"
                    >
                      Add cycle
                    </Button>
                  ) : undefined
                }
              />
            </PanelBody>
          ) : (
            <PanelBody>
              <div className="grid gap-4">
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
