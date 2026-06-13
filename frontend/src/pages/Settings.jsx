/**
 * Settings — the accessibility & preferences command centre.
 *
 * Appearance and Accessibility changes apply live across the whole app (they write
 * to PreferencesContext, which re-themes via CSS variables), so this page doubles
 * as its own preview. All controls are keyboard-operable with proper ARIA roles.
 */
import { useState } from "react";
import {
  User,
  Palette,
  Accessibility,
  Bell,
  Sparkles,
  Lock,
  Sun,
  Moon,
  Monitor,
  Keyboard,
  Smartphone,
  History,
  KeyRound,
  Check,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Card, Button, Input, StatusChip, useToast, cx } from "../components/ui";
import { usePreferences, DEFAULT_PREFS } from "../context/PreferencesContext";
import { useAuth } from "../context/AuthContext";

/* -------------------------------------------------------- accessible controls */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease focus-visible:ring-2 focus-visible:ring-accent-ring",
        checked ? "bg-accent" : "bg-border-strong"
      )}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ease",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-subtle p-1">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption font-medium transition-all duration-150 ease",
              active ? "bg-surface text-text-primary shadow-elev-1" : "text-text-secondary hover:text-text-primary"
            )}
          >
            {o.icon && <o.icon size={14} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Row({ title, desc, children }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md">
        <div className="text-body font-medium text-text-primary">{title}</div>
        {desc && <div className="mt-0.5 text-caption text-text-secondary">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Panel({ title, desc, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-title font-semibold text-text-primary">{title}</h2>
        {desc && <p className="mt-1 text-body text-text-secondary">{desc}</p>}
      </div>
      <div className="divide-y divide-border-subtle px-5">{children}</div>
    </Card>
  );
}

/* ------------------------------------------------------------- palette swatches */
const PALETTES = [
  { value: "none", label: "Default", sw: ["#15A463", "#E0402F", "#E8A100", "#2D74D6"] },
  { value: "protanopia", label: "Protanopia", sw: ["#009E73", "#D55E00", "#E69F00", "#0072B2"] },
  { value: "deuteranopia", label: "Deuteranopia", sw: ["#009E73", "#D55E00", "#E69F00", "#0072B2"] },
  { value: "tritanopia", label: "Tritanopia", sw: ["#009E73", "#D7263A", "#D55E00", "#CC79A7"] },
  { value: "achromatopsia", label: "Achromatopsia", sw: ["#6E6E6E", "#1E1E1E", "#505050", "#969696"] },
];

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI Preferences", icon: Sparkles },
  { id: "security", label: "Security", icon: Lock },
];

export default function Settings() {
  const { prefs, set, setGroup, reset } = usePreferences();
  const { user } = useAuth();
  const toast = useToast();
  const [active, setActive] = useState("profile");
  const [profile, setProfile] = useState({
    displayName: prefs.profile.displayName || user?.full_name || "",
    email: prefs.profile.email || user?.email || "",
  });

  const saveProfile = () => {
    setGroup("profile", profile);
    toast?.success("Profile saved");
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-display font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-body text-text-secondary">
          Personalise Pharmacy Manager — appearance and accessibility changes apply instantly across the app.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_1fr]">
        {/* Section nav */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-2 lg:self-start">
          <div role="tablist" aria-orientation="vertical" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(s.id)}
                  className={cx(
                    "flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-body font-medium transition-all duration-150 ease focus-visible:ring-2 focus-visible:ring-accent-ring",
                    on ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-subtle hover:text-text-primary"
                  )}
                >
                  <s.icon size={18} aria-hidden="true" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Section content */}
        <div role="tabpanel" className="space-y-5">
          {active === "profile" && (
            <Panel title="Profile" desc="Your display details. Role and access are managed by an administrator.">
              <Row title="Avatar" desc="Shown across the app header and audit trail.">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-title font-semibold text-accent">
                  {(profile.displayName || user?.username || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                </div>
              </Row>
              <Row title="Display name">
                <Input
                  value={profile.displayName}
                  onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  className="w-64"
                  aria-label="Display name"
                />
              </Row>
              <Row title="Email">
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  className="w-64"
                  aria-label="Email"
                />
              </Row>
              <Row title="Role" desc="Determines which areas you can access.">
                <StatusChip tone="info" icon={false}>
                  {user?.display_role || user?.role || "Staff"}
                </StatusChip>
              </Row>
              <Row title="">
                <Button onClick={saveProfile}>
                  <Save size={16} /> Save profile
                </Button>
              </Row>
            </Panel>
          )}

          {active === "appearance" && (
            <Panel title="Appearance" desc="Theme, text size and information density.">
              <Row title="Theme" desc="Follow your device, or pick light or dark.">
                <Segmented
                  label="Theme"
                  value={prefs.theme}
                  onChange={(v) => set({ theme: v })}
                  options={[
                    { value: "system", label: "System", icon: Monitor },
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                  ]}
                />
              </Row>
              <Row title="Text size" desc="Scales all interface text (WCAG resize support).">
                <Segmented
                  label="Text size"
                  value={prefs.fontScale}
                  onChange={(v) => set({ fontScale: v })}
                  options={[
                    { value: 1, label: "Default" },
                    { value: 1.15, label: "Large" },
                    { value: 1.3, label: "Larger" },
                    { value: 1.6, label: "Largest" },
                  ]}
                />
              </Row>
              <Row title="Density" desc="Comfortable spacing or a tighter, data-dense layout.">
                <Segmented
                  label="Density"
                  value={prefs.density}
                  onChange={(v) => set({ density: v })}
                  options={[
                    { value: "comfortable", label: "Comfortable" },
                    { value: "compact", label: "Compact" },
                  ]}
                />
              </Row>
            </Panel>
          )}

          {active === "accessibility" && (
            <>
              <Panel title="Colour vision" desc="Palettes tuned for colour-blindness. Status is always paired with an icon and label, never colour alone.">
                <Row title="Colour-blind palette" desc="Re-maps status and chart colours to a distinguishable set.">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PALETTES.map((p) => {
                      const on = prefs.cvd === p.value;
                      return (
                        <button
                          key={p.value}
                          onClick={() => set({ cvd: p.value })}
                          aria-pressed={on}
                          className={cx(
                            "rounded-lg border px-3 py-2 text-left transition-all duration-150 ease focus-visible:ring-2 focus-visible:ring-accent-ring",
                            on ? "border-accent bg-accent-soft" : "border-border-subtle hover:bg-subtle"
                          )}
                        >
                          <div className="mb-1.5 flex gap-1">
                            {p.sw.map((c) => (
                              <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
                            ))}
                          </div>
                          <div className="flex items-center gap-1 text-caption font-medium text-text-primary">
                            {on && <Check size={13} className="text-accent" />}
                            {p.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Row>
                <Row title="High contrast" desc="Stronger text and border contrast (WCAG 1.4.6).">
                  <Toggle label="High contrast" checked={prefs.contrast === "high"} onChange={(v) => set({ contrast: v ? "high" : "normal" })} />
                </Row>
              </Panel>

              <Panel title="Reading & motion" desc="Tune typography and animation to your needs.">
                <Row title="Dyslexia-friendly font" desc="Switches to a hyperlegible typeface with looser spacing.">
                  <Toggle label="Dyslexia-friendly font" checked={prefs.dyslexiaFont} onChange={(v) => set({ dyslexiaFont: v })} />
                </Row>
                <Row title="Reduce animations" desc="Minimises motion and transitions (WCAG 2.3.3).">
                  <Toggle label="Reduce animations" checked={prefs.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
                </Row>
                <Row title="Simplified interface" desc="Hides decorative elements to reduce visual clutter.">
                  <Toggle label="Simplified interface" checked={prefs.simplified} onChange={(v) => set({ simplified: v })} />
                </Row>
              </Panel>

              <Panel title="Input & motor" desc="Make targets easier to hit and the app fully keyboard-operable.">
                <Row title="Large click targets" desc="Enforces comfortable 44px+ hit areas (WCAG 2.5.8).">
                  <Toggle label="Large click targets" checked={prefs.largeTargets} onChange={(v) => set({ largeTargets: v })} />
                </Row>
                <Row title="Keyboard navigation" desc="Tab through everything; visible focus rings throughout.">
                  <span className="flex items-center gap-2 text-caption text-text-secondary">
                    <Keyboard size={16} aria-hidden="true" /> Always on
                  </span>
                </Row>
                <Row title="Screen-reader support" desc="Semantic landmarks, ARIA labels and a skip-to-content link.">
                  <StatusChip tone="success">Built in</StatusChip>
                </Row>
                <Row title="Reset accessibility" desc="Restore all preferences to their defaults.">
                  <Button variant="secondary" onClick={() => { reset(); toast?.info("Preferences reset to defaults"); }}>
                    Reset to defaults
                  </Button>
                </Row>
              </Panel>
            </>
          )}

          {active === "notifications" && (
            <Panel title="Notifications" desc="Choose what you're alerted about and how. Alerts are always visual — never audio-only.">
              {[
                ["expiry", "Expiry alerts", "Batches approaching their expiry date."],
                ["lowStock", "Low stock alerts", "Lines at or below their reorder level."],
                ["aiWarnings", "AI warnings", "Clinical safety flags and reorder nudges."],
                ["inApp", "In-app notifications", "Toasts and the notification centre badge."],
                ["email", "Email notifications", "A daily summary to your inbox."],
              ].map(([key, title, desc]) => (
                <Row key={key} title={title} desc={desc}>
                  <Toggle label={title} checked={prefs.notif[key]} onChange={(v) => setGroup("notif", { [key]: v })} />
                </Row>
              ))}
            </Panel>
          )}

          {active === "ai" && (
            <Panel title="AI preferences" desc="Tune how the Co-pilot forecasts, recommends and explains.">
              <Row title="Forecast sensitivity" desc="How reactive demand forecasting is to recent changes.">
                <Segmented
                  label="Forecast sensitivity"
                  value={prefs.ai.forecastSensitivity}
                  onChange={(v) => setGroup("ai", { forecastSensitivity: v })}
                  options={[
                    { value: "conservative", label: "Conservative" },
                    { value: "balanced", label: "Balanced" },
                    { value: "responsive", label: "Responsive" },
                  ]}
                />
              </Row>
              <Row title="Recommendation frequency" desc="How often the AI surfaces proactive suggestions.">
                <Segmented
                  label="Recommendation frequency"
                  value={prefs.ai.recommendationFrequency}
                  onChange={(v) => setGroup("ai", { recommendationFrequency: v })}
                  options={[
                    { value: "realtime", label: "Real-time" },
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                  ]}
                />
              </Row>
              <Row title="Explanation level" desc="Show reasoning and confidence on AI recommendations.">
                <Segmented
                  label="Explanation level"
                  value={prefs.ai.explanationLevel}
                  onChange={(v) => setGroup("ai", { explanationLevel: v })}
                  options={[
                    { value: "concise", label: "Concise" },
                    { value: "detailed", label: "Detailed" },
                  ]}
                />
              </Row>
              <Row title="Dashboard AI insights" desc="Show AI insight widgets on the dashboard and hub.">
                <Toggle label="Dashboard AI insights" checked={prefs.ai.showInsights} onChange={(v) => setGroup("ai", { showInsights: v })} />
              </Row>
            </Panel>
          )}

          {active === "security" && (
            <>
              <Panel title="Password" desc="Choose a strong, unique password.">
                <Row title="Current password">
                  <Input type="password" placeholder="••••••••" className="w-64" aria-label="Current password" />
                </Row>
                <Row title="New password">
                  <Input type="password" placeholder="••••••••" className="w-64" aria-label="New password" />
                </Row>
                <Row title="">
                  <Button onClick={() => toast?.info("Connect to the auth API to change passwords")}>
                    <KeyRound size={16} /> Update password
                  </Button>
                </Row>
              </Panel>

              <Panel title="Sessions & devices" desc="Where you're signed in.">
                <Row title="This device" desc="Active now · JWT session">
                  <span className="flex items-center gap-2 text-caption text-text-secondary">
                    <Smartphone size={16} aria-hidden="true" /> Current
                  </span>
                </Row>
                <Row title="Recent sign-ins" desc="Last login activity for this account.">
                  <span className="flex items-center gap-2 text-caption text-text-secondary">
                    <History size={16} aria-hidden="true" /> View history
                  </span>
                </Row>
                <Row title="Two-factor authentication" desc="An extra step at sign-in. Backend support is prepared.">
                  <StatusChip tone="warning">Set-up pending</StatusChip>
                </Row>
                <Row title="Sign out everywhere" desc="End all other active sessions.">
                  <Button variant="secondary" onClick={() => toast?.info("Connect to the auth API to revoke sessions")}>
                    <ShieldCheck size={16} /> Revoke sessions
                  </Button>
                </Row>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
