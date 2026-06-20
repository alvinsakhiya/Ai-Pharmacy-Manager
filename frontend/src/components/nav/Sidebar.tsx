import { NavLink } from "react-router-dom";

import { usePermissions } from "../../auth/usePermissions";
import { FUTURE_ITEMS, NAV_ITEMS } from "../../app/navConfig";

interface SidebarProps {
  onNavigate?: () => void;
}

const NAV_ICON: Record<string, string> = {
  Dashboard: "⌂",
  Users: "U",
  Organisation: "O",
  Medications: "+",
  Inventory: "□",
  "Stock Intelligence": "↗",
  Reports: "R",
  Alerts: "!",
  Reviews: "★",
  Patients: "P",
  "Audit Log": "A",
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const { can } = usePermissions();
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.requiredAnyOf ||
      item.requiredAnyOf.some((permission) => can(permission)),
  );

  return (
    <aside className="flex h-full w-72 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] shadow-2xl">
      <div className="border-b border-[var(--sidebar-border)] px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-400/10 text-xl font-bold text-teal-200 ring-1 ring-teal-300/20">
            +
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
              AI Pharmacy
            </p>
            <h1 className="mt-1 text-lg font-bold leading-6 text-white">
              Manager
            </h1>
          </div>
        </div>
      </div>

      <nav
        aria-label="Primary navigation"
        className="flex-1 overflow-y-auto px-3 py-5"
      >
        <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">
          Main
        </h2>
        <ul className="mt-3 space-y-1">
          {visibleItems.map((item) => (
            <li key={item.path}>
              <NavLink
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar-bg)]",
                    isActive
                      ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)] shadow-lg shadow-black/10"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  ].join(" ")
                }
                end={item.path === "/"}
                onClick={onNavigate}
                to={item.path}
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs font-bold"
                >
                  {NAV_ICON[item.label] ?? item.label.charAt(0)}
                </span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t border-[var(--sidebar-border)] pt-6">
          <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">
            Coming in later phases
          </h2>
          <ul className="mt-3 space-y-1">
            {FUTURE_ITEMS.map((item) => (
              <li key={item.label}>
                <span
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-500"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-xs"
                  >
                    {item.label.charAt(0)}
                  </span>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <p className="text-sm font-semibold text-white">System Status</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Local demo services operational.
        </p>
      </div>
    </aside>
  );
}
