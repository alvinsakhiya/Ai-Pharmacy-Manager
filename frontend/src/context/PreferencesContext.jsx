/**
 * PreferencesContext — accessibility & appearance settings as core architecture.
 *
 * State persists to localStorage and is applied to <html> via data-attributes and
 * the --fs custom property. Because the design tokens resolve to CSS variables
 * (see index.css + tailwind.config.js), changing these here re-themes the whole
 * app instantly — light/dark, high-contrast, colour-blind palettes, font scaling,
 * dyslexia font, reduced motion, density and simplified mode — with no per-screen code.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "pm_prefs";

export const DEFAULT_PREFS = {
  // Appearance
  theme: "system", // system | light | dark
  fontScale: 1, // 1 | 1.15 | 1.3 | 1.6
  density: "comfortable", // comfortable | compact
  // Accessibility
  cvd: "none", // none | protanopia | deuteranopia | tritanopia | achromatopsia
  contrast: "normal", // normal | high
  dyslexiaFont: false,
  reducedMotion: false,
  largeTargets: false,
  simplified: false,
  // Notifications
  notif: { expiry: true, lowStock: true, aiWarnings: true, email: false, inApp: true },
  // AI preferences
  ai: {
    forecastSensitivity: "balanced", // conservative | balanced | responsive
    recommendationFrequency: "daily", // realtime | daily | weekly
    explanationLevel: "detailed", // concise | detailed
    showInsights: true,
  },
  // Profile (display-layer; server remains source of truth)
  profile: { displayName: "", email: "", photo: null },
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const saved = JSON.parse(raw);
    return {
      ...DEFAULT_PREFS,
      ...saved,
      notif: { ...DEFAULT_PREFS.notif, ...(saved.notif || {}) },
      ai: { ...DEFAULT_PREFS.ai, ...(saved.ai || {}) },
      profile: { ...DEFAULT_PREFS.profile, ...(saved.profile || {}) },
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function resolveTheme(theme) {
  if (theme === "system") {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function apply(prefs) {
  const el = document.documentElement;
  el.setAttribute("data-theme", resolveTheme(prefs.theme));
  el.setAttribute("data-cvd", prefs.cvd);
  el.setAttribute("data-contrast", prefs.contrast);
  el.setAttribute("data-density", prefs.density);
  el.setAttribute("data-targets", prefs.largeTargets ? "large" : "normal");
  el.setAttribute("data-motion", prefs.reducedMotion ? "reduced" : "normal");
  el.setAttribute("data-font", prefs.dyslexiaFont ? "dyslexia" : "default");
  el.setAttribute("data-simplified", prefs.simplified ? "on" : "off");
  el.style.setProperty("--fs", String(prefs.fontScale || 1));
}

const PreferencesCtx = createContext(null);

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(load);

  // Apply + persist whenever prefs change.
  useEffect(() => {
    apply(prefs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable — settings still apply for the session */
    }
  }, [prefs]);

  // Track the OS theme while on "system".
  useEffect(() => {
    if (prefs.theme !== "system" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(prefs);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [prefs]);

  const set = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  const setGroup = useCallback(
    (group, patch) => setPrefs((p) => ({ ...p, [group]: { ...p[group], ...patch } })),
    []
  );
  const reset = useCallback(() => setPrefs({ ...DEFAULT_PREFS }), []);

  const value = useMemo(
    () => ({ prefs, set, setGroup, reset, resolvedTheme: resolveTheme(prefs.theme) }),
    [prefs, set, setGroup, reset]
  );

  return <PreferencesCtx.Provider value={value}>{children}</PreferencesCtx.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesCtx);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
