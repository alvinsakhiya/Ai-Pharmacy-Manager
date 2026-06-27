/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ContrastMode = "normal" | "high";
export type FontScale = "compact" | "normal" | "large" | "xlarge";
export type FocusMode = "default" | "enhanced";
export type ColourVisionMode =
  | "default"
  | "deuteranopia"
  | "protanopia"
  | "tritanopia";
export type PaperSize = "a4" | "a5" | "label_4x6" | "label_72x36";
export type PrintOrientation = "portrait" | "landscape";
export type PrintScale = "fit" | "actual";
export type DefaultOutputType = "dosette_tray" | "picking_list" | "stock_label";

export interface PrinterPreferences {
  paperSize: PaperSize;
  orientation: PrintOrientation;
  printScale: PrintScale;
  copies: number;
  labelPrinterName: string;
  defaultOutputType: DefaultOutputType;
}

export interface Preferences {
  contrast: ContrastMode;
  fontScale: FontScale;
  reduceMotion: boolean;
  focusMode: FocusMode;
  colourVisionMode: ColourVisionMode;
  dyslexiaSpacing: boolean;
  printer: PrinterPreferences;
}

interface PreferencesContextValue {
  preferences: Preferences;
  setContrast: (value: ContrastMode) => void;
  setFontScale: (value: FontScale) => void;
  setReduceMotion: (value: boolean) => void;
  setFocusMode: (value: FocusMode) => void;
  setColourVisionMode: (value: ColourVisionMode) => void;
  setDyslexiaSpacing: (value: boolean) => void;
  updatePrinterPreferences: (value: Partial<PrinterPreferences>) => void;
  reset: () => void;
}

const DEFAULTS: Preferences = {
  contrast: "normal",
  fontScale: "normal",
  reduceMotion: false,
  focusMode: "default",
  colourVisionMode: "default",
  dyslexiaSpacing: false,
  printer: {
    paperSize: "a4",
    orientation: "portrait",
    printScale: "fit",
    copies: 1,
    labelPrinterName: "",
    defaultOutputType: "dosette_tray",
  },
};

const STORAGE_KEY = "apm.preferences";

const FONT_SCALE_VALUE: Record<FontScale, string> = {
  compact: "93.75%",
  normal: "100%",
  large: "112.5%",
  xlarge: "125%",
};

const COLOUR_VISION_CLASSES: Record<ColourVisionMode, string> = {
  default: "colour-default",
  deuteranopia: "colour-deuteranopia",
  protanopia: "colour-protanopia",
  tritanopia: "colour-tritanopia",
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function loadPreferences(): Preferences {
  if (typeof window === "undefined") {
    return DEFAULTS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULTS;
    }
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    const parsedPrinter: Partial<PrinterPreferences> = parsed.printer ?? {};
    return {
      contrast: parsed.contrast === "high" ? "high" : "normal",
      fontScale:
        parsed.fontScale === "compact" ||
        parsed.fontScale === "large" ||
        parsed.fontScale === "xlarge"
          ? parsed.fontScale
          : "normal",
      reduceMotion: parsed.reduceMotion === true,
      focusMode: parsed.focusMode === "enhanced" ? "enhanced" : "default",
      colourVisionMode:
        parsed.colourVisionMode === "deuteranopia" ||
        parsed.colourVisionMode === "protanopia" ||
        parsed.colourVisionMode === "tritanopia"
          ? parsed.colourVisionMode
          : "default",
      dyslexiaSpacing: parsed.dyslexiaSpacing === true,
      printer: {
        paperSize:
          parsedPrinter.paperSize === "a5" ||
          parsedPrinter.paperSize === "label_4x6" ||
          parsedPrinter.paperSize === "label_72x36"
            ? parsedPrinter.paperSize
            : "a4",
        orientation:
          parsedPrinter.orientation === "landscape" ? "landscape" : "portrait",
        printScale: parsedPrinter.printScale === "actual" ? "actual" : "fit",
        copies:
          typeof parsedPrinter.copies === "number" &&
          Number.isFinite(parsedPrinter.copies)
            ? Math.min(9, Math.max(1, Math.round(parsedPrinter.copies)))
            : 1,
        labelPrinterName:
          typeof parsedPrinter.labelPrinterName === "string"
            ? parsedPrinter.labelPrinterName.slice(0, 80)
            : "",
        defaultOutputType:
          parsedPrinter.defaultOutputType === "picking_list" ||
          parsedPrinter.defaultOutputType === "stock_label"
            ? parsedPrinter.defaultOutputType
            : "dosette_tray",
      },
    };
  } catch {
    return DEFAULTS;
  }
}

function applyPreferences(preferences: Preferences) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle("contrast-high", preferences.contrast === "high");
  root.classList.toggle("reduce-motion", preferences.reduceMotion);
  root.classList.toggle("focus-enhanced", preferences.focusMode === "enhanced");
  root.classList.toggle("dyslexia-spacing", preferences.dyslexiaSpacing);
  Object.values(COLOUR_VISION_CLASSES).forEach((className) => {
    root.classList.remove(className);
  });
  root.classList.add(COLOUR_VISION_CLASSES[preferences.colourVisionMode]);
  root.style.fontSize = FONT_SCALE_VALUE[preferences.fontScale];
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);

  useEffect(() => {
    applyPreferences(preferences);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage failures (private mode, quota) — prefs still apply for the session.
    }
  }, [preferences]);

  const setContrast = useCallback((contrast: ContrastMode) => {
    setPreferences((current) => ({ ...current, contrast }));
  }, []);

  const setFontScale = useCallback((fontScale: FontScale) => {
    setPreferences((current) => ({ ...current, fontScale }));
  }, []);

  const setReduceMotion = useCallback((reduceMotion: boolean) => {
    setPreferences((current) => ({ ...current, reduceMotion }));
  }, []);

  const setFocusMode = useCallback((focusMode: FocusMode) => {
    setPreferences((current) => ({ ...current, focusMode }));
  }, []);

  const setColourVisionMode = useCallback((colourVisionMode: ColourVisionMode) => {
    setPreferences((current) => ({ ...current, colourVisionMode }));
  }, []);

  const setDyslexiaSpacing = useCallback((dyslexiaSpacing: boolean) => {
    setPreferences((current) => ({ ...current, dyslexiaSpacing }));
  }, []);

  const updatePrinterPreferences = useCallback(
    (printer: Partial<PrinterPreferences>) => {
      setPreferences((current) => ({
        ...current,
        printer: {
          ...current.printer,
          ...printer,
          copies:
            printer.copies === undefined
              ? current.printer.copies
              : Math.min(9, Math.max(1, Math.round(printer.copies))),
          labelPrinterName:
            printer.labelPrinterName === undefined
              ? current.printer.labelPrinterName
              : printer.labelPrinterName.slice(0, 80),
        },
      }));
    },
    [],
  );

  const reset = useCallback(() => setPreferences(DEFAULTS), []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      setContrast,
      setFontScale,
      setReduceMotion,
      setFocusMode,
      setColourVisionMode,
      setDyslexiaSpacing,
      updatePrinterPreferences,
      reset,
    }),
    [
      preferences,
      setContrast,
      setFontScale,
      setReduceMotion,
      setFocusMode,
      setColourVisionMode,
      setDyslexiaSpacing,
      updatePrinterPreferences,
      reset,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
