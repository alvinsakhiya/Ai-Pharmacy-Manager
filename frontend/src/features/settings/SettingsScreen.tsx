import { Contrast, Eye, RotateCcw, Type, Zap } from "lucide-react";

import {
  usePreferences,
  type ContrastMode,
  type FontScale,
} from "../../app/PreferencesContext";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { cn } from "../../lib/cn";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
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
      className="inline-flex rounded-full border border-line bg-surface-subtle p-1"
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
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
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
      <div className="shrink-0 sm:pl-4">{control}</div>
    </div>
  );
}

const CONTRAST_OPTIONS: SegmentedOption<ContrastMode>[] = [
  { value: "normal", label: "Standard" },
  { value: "high", label: "High" },
];

const FONT_SCALE_OPTIONS: SegmentedOption<FontScale>[] = [
  { value: "normal", label: "Default" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Larger" },
];

export function SettingsScreen() {
  const { preferences, setContrast, setFontScale, setReduceMotion, reset } =
    usePreferences();

  const isDefault =
    preferences.contrast === "normal" &&
    preferences.fontScale === "normal" &&
    !preferences.reduceMotion;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System"
        title="Settings"
        subtitle="Personalise the workspace for comfort and accessibility. Preferences are saved on this device and apply across the app."
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

      <Panel>
        <PanelHeader
          title="Display & accessibility"
          subtitle="Tune contrast, text size, and motion to suit how you work."
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
              icon={<Contrast className="h-[18px] w-[18px]" />}
              title="Contrast"
              description="High contrast darkens muted text and strengthens borders for better readability."
              control={
                <Segmented
                  ariaLabel="Contrast"
                  value={preferences.contrast}
                  options={CONTRAST_OPTIONS}
                  onChange={setContrast}
                />
              }
            />
            <SettingRow
              icon={<Type className="h-[18px] w-[18px]" />}
              title="Text size"
              description="Increase the base text size across the workspace without zooming the whole browser."
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
              icon={<Zap className="h-[18px] w-[18px]" />}
              title="Reduce motion"
              description="Minimise animations and transitions throughout the app."
              control={
                <Toggle
                  ariaLabel="Reduce motion"
                  checked={preferences.reduceMotion}
                  onChange={setReduceMotion}
                />
              }
            />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="About these settings"
          icon={<Eye className="h-4 w-4" />}
        />
        <PanelBody>
          <p className="text-sm leading-relaxed text-ink-soft">
            These accessibility preferences are stored locally in your browser and
            take effect immediately. They sit alongside the app's built-in support
            for full keyboard navigation, visible focus states, screen-reader
            labelling, and your operating system's own reduced-motion setting.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
