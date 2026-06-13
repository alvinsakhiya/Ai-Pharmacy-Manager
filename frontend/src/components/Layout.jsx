import {
  Bell,
  Boxes,
  CalendarClock,
  ClipboardList,
  Command,
  FileBarChart,
  LayoutDashboard,
  LineChart,
  LogOut,
  PackageSearch,
  Pill,
  ScanText,
  ScrollText,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import { cx } from "./ui";
import CommandBar from "./ai/CommandBar";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/dosette", label: "Dosette", icon: CalendarClock },
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
  { to: "/ai/safety", label: "Clinical Safety", icon: ShieldCheck },
  { to: "/ai/reorder", label: "Smart Reorder", icon: PackageSearch },
  { to: "/ai/intake", label: "Intake AI", icon: ScanText },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white shadow-elev-1">
        <Pill size={18} />
      </div>
      <div className="leading-tight">
        <div className="text-subtitle font-semibold tracking-tight">Pharmica</div>
        <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Stock &amp; Dosette</div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout, can } = useAuth();
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

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      {/* Sidebar */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border-subtle bg-surface md:flex">
        <div className="flex h-14 items-center border-b border-border-subtle px-3">
          <Brand />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.filter((n) => !n.roles || can(...n.roles)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium transition-all duration-150 ease",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-text-secondary hover:bg-subtle hover:text-text-primary"
                )
              }
            >
              <n.icon size={18} className="flex-shrink-0" />
              <span className="flex-1">{n.label}</span>
              {n.to === "/notifications" && unread > 0 && (
                <span className="rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white tnum">
                  {unread}
                </span>
              )}
            </NavLink>
          ))}

          <div className="px-3 pb-1 pt-4 text-micro uppercase text-text-tertiary">AI Suite</div>
          {AI_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium transition-all duration-150 ease",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-text-secondary hover:bg-subtle hover:text-text-primary"
                )
              }
            >
              <n.icon size={18} className="flex-shrink-0" />
              <span className="flex-1">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border-subtle p-3 text-[11px] text-text-tertiary">
          Simulated data · Not for clinical use
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border-subtle bg-surface/80 px-4 backdrop-blur">
          <button
            onClick={() => setCmdOpen(true)}
            className="group flex h-9 w-72 items-center gap-2.5 rounded-md border border-border-subtle bg-app px-3 text-text-tertiary transition-all duration-150 ease hover:border-border-strong hover:bg-subtle active:scale-[0.99]"
          >
            <Sparkles size={15} className="text-accent" />
            <span className="flex-1 text-left text-body">Ask the Co-pilot…</span>
            <kbd className="flex items-center gap-0.5 rounded border border-border-subtle bg-surface px-1.5 py-0.5 text-[11px] font-medium text-text-tertiary">
              <Command size={11} /> K
            </kbd>
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-caption font-semibold text-text-primary">{user?.full_name}</div>
              <div className="text-[11px] capitalize text-text-tertiary">{user?.display_role || user?.role}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-caption font-semibold text-accent">
              {initials}
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-md p-2 text-text-tertiary hover:bg-subtle hover:text-danger-fg transition"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mx-auto max-w-[1400px] animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
