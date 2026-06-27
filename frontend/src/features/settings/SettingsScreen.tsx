import {
  Accessibility,
  AlignLeft,
  Contrast,
  Copy,
  Eye,
  FileText,
  Focus,
  Palette,
  Printer,
  RotateCcw,
  Type,
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
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { inputClass, labelClass, selectClass } from "../../components/ui/forms";
import { PageHeader } from "../../components/ui/PageHeader";
import { cn } from "../../lib/cn";

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

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
        <div className="min-w-0 space-y-5">
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
