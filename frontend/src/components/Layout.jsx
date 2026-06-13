import {
  Bell,
  Boxes,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LineChart,
  ListChecks,
  LogOut,
  Moon,
  PackageSearch,
  Pill,
  ScanText,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  TimerReset,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usePreferences } from "../context/PreferencesContext";
import api from "../api/client";
import { cx } from "./ui";
import CommandBar from "./ai/CommandBar";
import PatientSearchBar from "./patients/PatientSearchBar";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  // Patients are reached via the top search bar for all staff; the sidebar entry
  // (full patient list) is reserved for administrators.
  { to: "/patients", label: "Patients", icon: Users, roles: ["administrator"] },
  { to: "/picking", label: "Picking lists", icon: ClipboardList },
  { to: "/stock", label: "Stock", icon: Boxes },
  { to: "/expiry", label: "Expiry", icon: TimerReset },
  { to: "/forecasting", label: "Forecasting", icon: LineChart },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/audit", label: "Audit log", icon: ScrollText, roles: ["pharmacist"] },
];

const AI_NAV = [
  { to: "/ai", label: "AI Co-pilot", icon: Sparkles, end: true },
  { to: "/ai/brief", label: "Daily Brief", icon: ListChecks },
  { to: "/ai/safety", label: "Clinical Safety", icon: ShieldCheck },
  { to: "/ai/reorder", label: "Smart Reorder", icon: PackageSearch },
  { to: "/ai/intake", label: "Intake AI", icon: ScanText },
];

const navClass = ({ isActive }) =>
  cx(
    "group flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium transition-all duration-150 ease",
    "focus-visible:ring-2 focus-visible:ring-accent-ring",
    isActive
      ? "bg-accent-soft text-accent"
      : "text-text-secondary hover:bg-subtle hover:text-text-primary"
  );

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-elev-1" aria-hidden="true">
        <Pill size={18} />
      </div>
      <div className="leading-tight">
        <div className="text-subtitle font-semibold tracking-tight">Pharmacy Manager</div>
        <div className="text-[10px] uppercase tracking-wider text-text-tertiary">AI-Enhanced Dosette &amp; Stock</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout, can } = useAuth();
  const { resolvedTheme, set } = usePreferences();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    api.get("/notifications/unread_count/").then((r) => setUnread(r.data.count)).catch(() => {});
  }, []);

  // Global ⌘K / Ctrl+K opens the Co-pilot; other surfaces can fire "copilot:open".
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    const onOpen = () => setCmdOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("copilot:open", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("copilot:open", onOpen);
    };
  }, []);

  const initials = (user?.full_name || user?.username || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const toggleTheme = () => set({ theme: resolvedTheme === "dark" ? "light" : "dark" });

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar */}
      <aside
        className="hidden w-60 flex-shrink-0 flex-col border-r border-border-subtle bg-surface md:flex"
        aria-label="Primary"
      >
        <div className="flex h-14 items-center border-b border-border-subtle px-3">
          <Brand />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main navigation">
          {NAV.filter((n) => !n.roles || can(...n.roles)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
              <n.icon size={18} className="flex-shrink-0" aria-hidden="true" />
              <span className="flex-1">{n.label}</span>
              {n.to === "/notifications" && unread > 0 && (
                <span
                  className="rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white tnum"
                  aria-label={`${unread} unread notifications`}
                >
                  {unread}
                </span>
              )}
            </NavLink>
          ))}

          <div className="px-3 pb-1 pt-4 text-micro uppercase text-text-tertiary" role="presentation">
            AI Suite
          </div>
          {AI_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
              <n.icon size={18} className="flex-shrink-0" aria-hidden="true" />
              <span className="flex-1">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="space-y-0.5 border-t border-border-subtle p-2">
          <NavLink to="/settings" className={navClass}>
            <SettingsIcon size={18} className="flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">Settings</span>
          </NavLink>
          <p className="px-3 pt-1 text-[11px] text-text-tertiary">Simulated data · Not for clinical use</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border-subtle bg-surface/80 px-4 backdrop-blur">
          <div className="flex flex-1 items-center pr-3">
            <PatientSearchBar />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden rounded-md p-2 text-text-tertiary transition hover:bg-subtle hover:text-accent sm:block"
              aria-label="Open AI Co-pilot (Command K)"
              title="AI Co-pilot (⌘K)"
            >
              <Sparkles size={18} />
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-md p-2 text-text-tertiary transition hover:bg-subtle hover:text-text-primary"
              aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
            >
              {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NavLink
              to="/settings"
              className="rounded-md p-2 text-text-tertiary transition hover:bg-subtle hover:text-text-primary"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon size={18} />
            </NavLink>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-caption font-semibold text-text-primary">{user?.full_name}</div>
              <div className="text-[11px] capitalize text-text-tertiary">{user?.display_role || user?.role}</div>
            </div>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-caption font-semibold text-accent"
              aria-hidden="true"
            >
              {initials}
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-md p-2 text-text-tertiary transition hover:bg-subtle hover:text-danger-fg"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-5 outline-none lg:p-6">
          <div className="mx-auto max-w-[1400px] animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
