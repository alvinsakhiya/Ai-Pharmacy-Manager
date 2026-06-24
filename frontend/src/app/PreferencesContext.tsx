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
export type FontScale = "normal" | "large" | "xlarge";

export interface Preferences {
  contrast: ContrastMode;
  fontScale: FontScale;
  reduceMotion: boolean;
}

interface PreferencesContextValue {
  preferences: Preferences;
  setContrast: (value: ContrastMode) => void;
  setFontScale: (value: FontScale) => void;
  setReduceMotion: (value: boolean) => void;
  reset: () => void;
}

const DEFAULTS: Preferences = {
  contrast: "normal",
  fontScale: "normal",
  reduceMotion: false,
};

const STORAGE_KEY = "apm.preferences";

const FONT_SCALE_VALUE: Record<FontScale, string> = {
  normal: "100%",
  large: "112.5%",
  xlarge: "125%",
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
    return {
      contrast: parsed.contrast === "high" ? "high" : "normal",
      fontScale:
        parsed.fontScale === "large" || parsed.fontScale === "xlarge"
          ? parsed.fontScale
          : "normal",
      reduceMotion: parsed.reduceMotion === true,
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

  const reset = useCallback(() => setPreferences(DEFAULTS), []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ preferences, setContrast, setFontScale, setReduceMotion, reset }),
    [preferences, setContrast, setFontScale, setReduceMotion, reset],
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
