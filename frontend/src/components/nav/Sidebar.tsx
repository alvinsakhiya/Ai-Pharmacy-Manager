import { NavLink } from "react-router-dom";

import { usePermissions } from "../../auth/usePermissions";
import { FUTURE_ITEMS, NAV_ITEMS } from "../../app/navConfig";

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { can } = usePermissions();
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.requiredAnyOf ||
      item.requiredAnyOf.some((permission) => can(permission)),
  );

  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
          Pharmacy Admin
        </p>
        <h1 className="mt-2 text-xl font-bold text-slate-950">
          AI Pharmacy Manager
        </h1>
      </div>

      <nav
        aria-label="Primary navigation"
        className="flex-1 overflow-y-auto px-4 py-5"
      >
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.path}>
              <NavLink
                className={({ isActive }) =>
                  [
                    "block rounded-xl px-4 py-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
                    isActive
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                  ].join(" ")
                }
                end={item.path === "/"}
                onClick={onNavigate}
                to={item.path}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Coming in later phases
          </h2>
          <ul className="mt-3 space-y-1">
            {FUTURE_ITEMS.map((item) => (
              <li key={item.label}>
                <span
                  aria-disabled="true"
                  className="block cursor-not-allowed rounded-xl px-4 py-3 text-sm font-medium text-slate-400"
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
