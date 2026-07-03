import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Accessibility,
  AlignLeft,
  Bell,
  Boxes,
  Building2,
  ClipboardList,
  Contrast,
  Copy,
  Database,
  Eye,
  FileText,
  Focus,
  Lock,
  Palette,
  Pill,
  Printer,
  RotateCcw,
  Type,
  UserRound,
  Zap,
} from "lucide-react";

import {
  usePreferences,
  type ColourVisionMode,
  type ContrastMode,
  type DefaultOutputType,
  type FocusMode,
  type FontScale,
  type PaperSize,
  type PrintOrientation,
  type PrintScale,
} from "../../app/PreferencesContext";
import { useAuth } from "../../auth/AuthContext";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { inputClass, labelClass, selectClass } from "../../components/ui/forms";
import { PageHeader } from "../../components/ui/PageHeader";
import { ApiError } from "../../lib/apiClient";
import { errorMessages, normalizeErrors } from "../../lib/apiErrors";
import { cn } from "../../lib/cn";
import {
  getBackupSchedule,
  listBackupRuns,
  restoreBackup,
  runBackupNow,
  updateBackupSchedule,
  type BackupRun,
} from "./settingsApi";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SelectOption<T extends string> extends SegmentedOption<T> {
  description?: string;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-full min-w-0 flex-wrap rounded-full border border-line bg-surface-subtle p-1 sm:w-auto"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 ease-soft active:scale-[0.97] focus-ring",
              active
                ? "bg-surface text-ink shadow-elev-1"
                : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-soft focus-ring",
        checked ? "bg-brand" : "bg-line-strong",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-elev-1 transition-transform duration-200 ease-soft",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <label className={labelClass} htmlFor={id}>
      {label}
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SettingRow({
  icon,
  title,
  description,
  control,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-lilac-soft bg-lilac-soft text-brand"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">{title}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="min-w-0 sm:shrink-0 sm:pl-4">{control}</div>
    </div>
  );
}

function SettingsHubCard({
  description,
  icon,
  status,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  status: "Available" | "Local preference" | "Coming soon" | "Demo status";
  title: string;
}) {
  const variant =
    status === "Coming soon"
      ? "neutral"
      : status === "Demo status"
        ? "info"
        : "brand";

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-lilac-soft bg-lilac-soft text-brand"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-extrabold text-ink">{title}</h2>
            <Badge variant={variant}>{status}</Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        </div>
      </div>
    </article>
  );
}

function formatBackupTime(value: string | null): string {
  if (!value) {
    return "Not run yet";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFileSize(bytes: number): string {
  if (bytes <= 0) {
    return "No file";
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const backupErrorClass =
  "rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink";

// Backup 4xx responses carry operator-safe detail messages (e.g. "Selected
// backup has no archive file."); anything else gets the generic fallback.
function backupActionError(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status < 500) {
    const detail = errorMessages(normalizeErrors(error), "detail");
    if (detail.length > 0) {
      return detail.join(" ");
    }
  }
  return fallback;
}

function BackupRunRow({
  canRestore,
  onSelectRestore,
  run,
}: {
  canRestore: boolean;
  onSelectRestore: (run: BackupRun) => void;
  run: BackupRun;
}) {
  const restorable = run.status === "SUCCESS" || run.status === "RESTORED";
  const variant = restorable
    ? "brand"
    : run.status === "FAILED"
      ? "danger"
      : "neutral";

  return (
    <li className="rounded-xl border border-line bg-surface px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-extrabold text-ink">
              {formatBackupTime(run.completed_at ?? run.started_at)}
            </p>
            <Badge variant={variant}>{run.status.toLowerCase()}</Badge>
          </div>
          <p className="mt-1 text-xs font-semibold text-muted">
            {run.trigger.toLowerCase().replace("_", " ")} ·{" "}
            {formatFileSize(run.file_size)}
          </p>
        </div>
        {canRestore && restorable ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onSelectRestore(run)}
          >
            Restore
          </Button>
        ) : !canRestore ? (
          <Badge variant="neutral">Admin only</Badge>
        ) : null}
      </div>
      {run.error_message ? (
        <p className="mt-2 text-xs font-medium text-danger">{run.error_message}</p>
      ) : null}
    </li>
  );
}

function BackupRestorePanel({
  canManage,
  canRestore,
}: {
  canManage: boolean;
  canRestore: boolean;
}) {
  const queryClient = useQueryClient();
  const [dailyTime, setDailyTime] = useState("02:00");
  const [restoreRun, setRestoreRun] = useState<BackupRun | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");

  const scheduleQuery = useQuery({
    queryKey: ["settings", "backups", "schedule"],
    queryFn: getBackupSchedule,
    enabled: canManage,
  });
  const runsQuery = useQuery({
    queryKey: ["settings", "backups", "runs"],
    queryFn: listBackupRuns,
    enabled: canManage,
  });
  const scheduleMutation = useMutation({
    mutationFn: updateBackupSchedule,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "backups"] });
    },
  });
  const runNowMutation = useMutation({
    mutationFn: runBackupNow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings", "backups"] });
    },
  });
  const restoreMutation = useMutation({
    mutationFn: restoreBackup,
    onSuccess: async () => {
      setRestoreRun(null);
      setRestoreConfirm("");
      await queryClient.invalidateQueries({ queryKey: ["settings", "backups"] });
    },
  });

  useEffect(() => {
    if (scheduleQuery.data?.daily_time) {
      setDailyTime(scheduleQuery.data.daily_time.slice(0, 5));
    }
  }, [scheduleQuery.data?.daily_time]);

  if (!canManage) {
    return (
      <Panel>
        <PanelHeader
          title="Backup & restore"
          subtitle="Operational backup settings."
          icon={<Database className="h-4 w-4" />}
          actions={<Badge variant="neutral">Restricted</Badge>}
        />
        <PanelBody>
          <p className="text-sm leading-relaxed text-ink-soft">
            Backup settings are available to admin and pharmacist accounts.
          </p>
        </PanelBody>
      </Panel>
    );
  }

  const schedule = scheduleQuery.data;
  const runs = runsQuery.data ?? [];
  const busy =
    scheduleMutation.isPending ||
    runNowMutation.isPending ||
    restoreMutation.isPending;

  return (
    <Panel>
      <PanelHeader
        title="Backup & restore"
        subtitle="Local group backup controls."
        icon={<Database className="h-4 w-4" />}
        actions={
          <Badge variant={schedule?.enabled ? "brand" : "neutral"}>
            {schedule?.enabled ? "Scheduled" : "Manual"}
          </Badge>
        }
      />
      <PanelBody>
        {scheduleQuery.isError ? (
          <p className="rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm font-medium text-warning-ink">
            Backup settings are unavailable for this scope.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface-subtle p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className={cn(labelClass, "flex-1")} htmlFor="backup-time">
                  Daily backup time
                  <input
                    id="backup-time"
                    type="time"
                    className={inputClass}
                    value={dailyTime}
                    disabled={!schedule || busy}
                    onChange={(event) => setDailyTime(event.target.value)}
                    onBlur={() => {
                      if (dailyTime) {
                        scheduleMutation.mutate({ daily_time: dailyTime });
                      }
                    }}
                  />
                </label>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                  <span className="text-sm font-bold text-ink">Daily schedule</span>
                  <Toggle
                    ariaLabel="Enable daily backups"
                    checked={schedule?.enabled ?? false}
                    onChange={(enabled) => scheduleMutation.mutate({ enabled })}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {schedule?.scheduler_note ??
                  "Scheduled backups run when the scheduler command is active."}
              </p>
              {scheduleMutation.isError ? (
                <p className={cn(backupErrorClass, "mt-3")}>
                  {backupActionError(
                    scheduleMutation.error,
                    "The schedule change was not saved. Please try again.",
                  )}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-ink">Latest backups</p>
                <p className="text-xs font-medium text-muted">
                  Retention keeps the latest {schedule?.retention_count ?? 3} files.
                </p>
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => runNowMutation.mutate()}
              >
                Run backup now
              </Button>
            </div>

            {runNowMutation.isError ? (
              <p className={backupErrorClass}>
                {backupActionError(
                  runNowMutation.error,
                  "The backup did not run. Please try again.",
                )}
              </p>
            ) : null}

            {runsQuery.isLoading ? (
              <p className="text-sm font-medium text-muted">Loading backups…</p>
            ) : runsQuery.isError ? (
              <p className={backupErrorClass}>
                Could not load the backup history. Reload the page or try again
                later.
              </p>
            ) : runs.length ? (
              <ul className="space-y-2">
                {runs.map((run) => (
                  <BackupRunRow
                    key={run.id}
                    run={run}
                    canRestore={canRestore}
                    onSelectRestore={(nextRun) => {
                      setRestoreRun(nextRun);
                      setRestoreConfirm("");
                    }}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-line bg-surface-subtle px-4 py-3 text-sm font-medium text-muted">
                No backups have been created for this group yet.
              </p>
            )}

            {restoreRun ? (
              <div className="rounded-xl border border-warning-border bg-warning-soft p-4">
                <p className="text-sm font-extrabold text-warning-ink">
                  Restore backup from{" "}
                  {formatBackupTime(
                    restoreRun.completed_at ?? restoreRun.started_at,
                  )}
                </p>
                {restoreMutation.isError ? (
                  <p className={cn(backupErrorClass, "mt-3")}>
                    {backupActionError(
                      restoreMutation.error,
                      "The restore was not applied. Please try again.",
                    )}
                  </p>
                ) : null}
                <label className={cn(labelClass, "mt-3")} htmlFor="restore-confirm">
                  Type RESTORE to confirm
                  <input
                    id="restore-confirm"
                    className={inputClass}
                    value={restoreConfirm}
                    onChange={(event) => setRestoreConfirm(event.target.value)}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={restoreConfirm !== "RESTORE" || busy}
                    onClick={() => restoreMutation.mutate(restoreRun.id)}
                  >
                    Restore selected backup
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRestoreRun(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

const CONTRAST_OPTIONS: SegmentedOption<ContrastMode>[] = [
  { value: "normal", label: "Standard" },
  { value: "high", label: "High" },
];

const FONT_SCALE_OPTIONS: SegmentedOption<FontScale>[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Default" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

const FOCUS_OPTIONS: SegmentedOption<FocusMode>[] = [
  { value: "default", label: "Default" },
  { value: "enhanced", label: "Enhanced" },
];

const COLOUR_VISION_OPTIONS: SelectOption<ColourVisionMode>[] = [
  { value: "default", label: "Default" },
  { value: "deuteranopia", label: "Deuteranopia support" },
  { value: "protanopia", label: "Protanopia support" },
  { value: "tritanopia", label: "Tritanopia support" },
];

const PAPER_SIZE_OPTIONS: SelectOption<PaperSize>[] = [
  { value: "a4", label: "A4" },
  { value: "a5", label: "A5" },
  { value: "label_4x6", label: "4x6 label" },
  { value: "label_72x36", label: "72x36 label" },
];

const ORIENTATION_OPTIONS: SelectOption<PrintOrientation>[] = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

const PRINT_SCALE_OPTIONS: SelectOption<PrintScale>[] = [
  { value: "fit", label: "Fit to page" },
  { value: "actual", label: "Actual size" },
];

const COPY_OPTIONS: SelectOption<string>[] = Array.from({ length: 9 }, (_, i) => {
  const value = String(i + 1);
  return { value, label: value };
});

const OUTPUT_OPTIONS: SelectOption<DefaultOutputType>[] = [
  { value: "dosette_tray", label: "Dosette tray sheet" },
  { value: "picking_list", label: "Picking list" },
  { value: "stock_label", label: "Stock label" },
];

export function SettingsScreen() {
  const { user } = useAuth();
  const {
    preferences,
    setContrast,
    setFontScale,
    setReduceMotion,
    setFocusMode,
    setColourVisionMode,
    setDyslexiaSpacing,
    updatePrinterPreferences,
    reset,
  } = usePreferences();

  const isDefault =
    preferences.contrast === "normal" &&
    preferences.fontScale === "normal" &&
    !preferences.reduceMotion &&
    preferences.focusMode === "default" &&
    preferences.colourVisionMode === "default" &&
    !preferences.dyslexiaSpacing &&
    preferences.printer.paperSize === "a4" &&
    preferences.printer.orientation === "portrait" &&
    preferences.printer.printScale === "fit" &&
    preferences.printer.copies === 1 &&
    preferences.printer.labelPrinterName === "" &&
    preferences.printer.defaultOutputType === "dosette_tray";
  const canManageBackups = user?.role === "ADMIN" || user?.role === "PHARMACIST";
  const canRestoreBackups = user?.role === "ADMIN";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Changes apply instantly and are saved on this device."
        actions={
          <Button
            variant="secondary"
            leadingIcon={<RotateCcw className="h-4 w-4" />}
            disabled={isDefault}
            onClick={reset}
          >
            Reset to defaults
          </Button>
        }
      />

      <section
        aria-label="Settings hub"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <SettingsHubCard
          icon={<Database className="h-5 w-5" />}
          title="Backup & restore"
          status="Available"
          description="Daily local backups, latest runs, and guarded restore."
        />
        <SettingsHubCard
          icon={<UserRound className="h-5 w-5" />}
          title="Profile & account"
          status="Demo status"
          description="Account identity and session controls stay managed by auth."
        />
        <SettingsHubCard
          icon={<Building2 className="h-5 w-5" />}
          title="Pharmacy workspace"
          status="Demo status"
          description="Scope and pharmacy access are inherited from team membership."
        />
        <SettingsHubCard
          icon={<Accessibility className="h-5 w-5" />}
          title="Accessibility"
          status="Available"
          description="Text, contrast, focus, colour, and motion preferences."
        />
        <SettingsHubCard
          icon={<Printer className="h-5 w-5" />}
          title="Printer & labels"
          status="Local preference"
          description="Device-level defaults for sheets, lists, and labels."
        />
        <SettingsHubCard
          icon={<Bell className="h-5 w-5" />}
          title="Notifications"
          status="Coming soon"
          description="Review alert preferences when backend settings are available."
        />
        <SettingsHubCard
          icon={<Pill className="h-5 w-5" />}
          title="MDS / Dosette preferences"
          status="Coming soon"
          description="Future defaults for tray views and print preparation."
        />
        <SettingsHubCard
          icon={<Boxes className="h-5 w-5" />}
          title="Inventory preferences"
          status="Coming soon"
          description="Future defaults for stock review and expiry display."
        />
        <SettingsHubCard
          icon={<Lock className="h-5 w-5" />}
          title="Security & audit"
          status="Demo status"
          description="Role access and audit trail remain enforced by the system."
        />
        <SettingsHubCard
          icon={<ClipboardList className="h-5 w-5" />}
          title="Demo / system status"
          status="Demo status"
          description="Operational settings shown here do not change business logic."
        />
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
        <div className="min-w-0 space-y-5">
          <BackupRestorePanel
            canManage={canManageBackups}
            canRestore={canRestoreBackups}
          />

          <Panel>
            <PanelHeader
              title="Appearance"
              subtitle="Adjust density, text scale, and contrast."
              icon={<Eye className="h-4 w-4" />}
              actions={
                isDefault ? (
                  <Badge variant="neutral">Defaults</Badge>
                ) : (
                  <Badge variant="brand">Customised</Badge>
                )
              }
            />
            <PanelBody>
              <div className="divide-y divide-line">
                <SettingRow
                  icon={<Type className="h-[18px] w-[18px]" />}
                  title="Text size"
                  description="Set the workspace text scale without changing browser zoom."
                  control={
                    <Segmented
                      ariaLabel="Text size"
                      value={preferences.fontScale}
                      options={FONT_SCALE_OPTIONS}
                      onChange={setFontScale}
                    />
                  }
                />
                <SettingRow
                  icon={<Contrast className="h-[18px] w-[18px]" />}
                  title="High contrast"
                  description="Strengthen muted text, borders, and focus outlines."
                  control={
                    <Segmented
                      ariaLabel="Contrast"
                      value={preferences.contrast}
                      options={CONTRAST_OPTIONS}
                      onChange={setContrast}
                    />
                  }
                />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Accessibility"
              subtitle="Colour, focus, and reading preferences."
              icon={<Accessibility className="h-4 w-4" />}
            />
            <PanelBody>
              <div className="divide-y divide-line">
                <SettingRow
                  icon={<Focus className="h-[18px] w-[18px]" />}
                  title="Focus visibility"
                  description="Make keyboard focus targets more prominent across the app."
                  control={
                    <Segmented
                      ariaLabel="Focus visibility"
                      value={preferences.focusMode}
                      options={FOCUS_OPTIONS}
                      onChange={setFocusMode}
                    />
                  }
                />
                <SettingRow
                  icon={<Palette className="h-[18px] w-[18px]" />}
                  title="Colour-blind support"
                  description="Shift key interface accents while keeping text labels visible."
                  control={
                    <SelectField
                      id="settings-colour-vision"
                      label="Colour vision mode"
                      value={preferences.colourVisionMode}
                      options={COLOUR_VISION_OPTIONS}
                      onChange={setColourVisionMode}
                    />
                  }
                />
                <SettingRow
                  icon={<AlignLeft className="h-[18px] w-[18px]" />}
                  title="Dyslexia-friendly spacing"
                  description="Relax line spacing and character spacing for easier scanning."
                  control={
                    <Toggle
                      ariaLabel="Dyslexia-friendly spacing"
                      checked={preferences.dyslexiaSpacing}
                      onChange={setDyslexiaSpacing}
                    />
                  }
                />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Motion"
              subtitle="Reduce interface movement when preferred."
              icon={<Zap className="h-4 w-4" />}
            />
            <PanelBody>
              <SettingRow
                icon={<Zap className="h-[18px] w-[18px]" />}
                title="Reduced motion"
                description="Minimise transitions and animations throughout the workspace."
                control={
                  <Toggle
                    ariaLabel="Reduce motion"
                    checked={preferences.reduceMotion}
                    onChange={setReduceMotion}
                  />
                }
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Printer preferences"
              subtitle="Defaults for print sheets, lists, and labels on this device."
              icon={<Printer className="h-4 w-4" />}
            />
            <PanelBody>
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  id="settings-paper-size"
                  label="Default paper size"
                  value={preferences.printer.paperSize}
                  options={PAPER_SIZE_OPTIONS}
                  onChange={(paperSize) => updatePrinterPreferences({ paperSize })}
                />
                <SelectField
                  id="settings-orientation"
                  label="Orientation"
                  value={preferences.printer.orientation}
                  options={ORIENTATION_OPTIONS}
                  onChange={(orientation) =>
                    updatePrinterPreferences({ orientation })
                  }
                />
                <SelectField
                  id="settings-print-scale"
                  label="Print scale"
                  value={preferences.printer.printScale}
                  options={PRINT_SCALE_OPTIONS}
                  onChange={(printScale) => updatePrinterPreferences({ printScale })}
                />
                <SelectField
                  id="settings-copies"
                  label="Default copies"
                  value={String(preferences.printer.copies)}
                  options={COPY_OPTIONS}
                  onChange={(copies) =>
                    updatePrinterPreferences({ copies: Number(copies) })
                  }
                />
                <SelectField
                  id="settings-output-type"
                  label="Default output type"
                  value={preferences.printer.defaultOutputType}
                  options={OUTPUT_OPTIONS}
                  onChange={(defaultOutputType) =>
                    updatePrinterPreferences({ defaultOutputType })
                  }
                />
                <label className={labelClass} htmlFor="settings-printer-note">
                  Label printer note
                  <input
                    id="settings-printer-note"
                    className={inputClass}
                    type="text"
                    maxLength={80}
                    placeholder="Zebra ZD230"
                    value={preferences.printer.labelPrinterName}
                    onChange={(event) =>
                      updatePrinterPreferences({
                        labelPrinterName: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <p className="mt-4 rounded-xl border border-line bg-surface-subtle px-4 py-3 text-[13px] font-medium leading-relaxed text-ink-soft">
                Printer preferences are saved on this device. Browser print
                settings may still need to be confirmed before printing.
              </p>
            </PanelBody>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader
              title="Preview"
              subtitle="A quick view of the current accessibility settings."
              icon={<Palette className="h-4 w-4" />}
            />
            <PanelBody>
              <div className="space-y-4 rounded-2xl border border-line bg-surface-subtle p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="brand" dot>
                    Review before action
                  </Badge>
                  <Badge variant="warning" dot>
                    Needs attention
                  </Badge>
                </div>
                <Button
                  variant="primary"
                  leadingIcon={<FileText className="h-4 w-4" />}
                >
                  Open record
                </Button>
                <label className={labelClass} htmlFor="settings-preview-field">
                  Sample form field
                  <input
                    id="settings-preview-field"
                    className={inputClass}
                    readOnly
                    value="Batch reference B-102"
                  />
                </label>
                <div className="rounded-xl border border-info-border bg-info-soft px-4 py-3 text-sm leading-relaxed text-info-ink">
                  Scheduled signals and printer preferences stay readable with
                  text labels, not colour alone.
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Device storage"
              subtitle="Local preferences only."
              icon={<Copy className="h-4 w-4" />}
            />
            <PanelBody>
              <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
                <p>
                  Accessibility and printer preferences are stored in this
                  browser. They do not change pharmacy records, stock movement,
                  Work Queue items, or patient data.
                </p>
                <p>
                  The browser print dialog remains the final place to confirm
                  printer destination, paper handling, and copies.
                </p>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </section>
    </div>
  );
}
