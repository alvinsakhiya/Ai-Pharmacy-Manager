import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { FUTURE_ITEMS, NAV_ITEMS, type NavItem } from "../../app/navConfig";
import { scopeLabel } from "../../lib/scope";
import { cn } from "../../lib/cn";
import { Logo } from "../ui/Logo";

interface SidebarProps {
  onNavigate?: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "·";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function NavItemLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        className={({ isActive }) =>
          cn(
            "group flex items-center gap-3.5 rounded-full px-4 py-3 text-[15px] font-semibold outline-none transition-all duration-200 ease-soft",
            "focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
            isActive
              ? "bg-lilac text-lilac-ink shadow-elev-1"
              : "text-sidebar-text/85 hover:bg-sidebar-raised hover:text-white",
          )
        }
        end={item.path === "/"}
        onClick={onNavigate}
        to={item.path}
      >
        {({ isActive }) => (
          <>
            <Icon
              aria-hidden="true"
              className={cn(
                "h-[20px] w-[20px] shrink-0 transition-colors",
                isActive
                  ? "text-lilac-ink"
                  : "text-sidebar-muted group-hover:text-white",
              )}
            />
            {item.label}
          </>
        )}
      </NavLink>
    </li>
  );
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { can } = usePermissions();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.requiredAnyOf ||
      item.requiredAnyOf.some((permission) => can(permission)),
  );

  // Flat list (ShipMates-style) with a single divider before the utility items.
  const mainItems = visibleItems.filter((item) => item.group !== "System");
  const utilityItems = visibleItems.filter((item) => item.group === "System");

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const displayName = user ? user.full_name || user.email : "";

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sidebar-text">
      <div className="flex items-center gap-3 px-6 py-6">
        <Logo size={44} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-white">
            AI Pharmacy Manager
          </p>
          <p className="mt-0.5 text-xs text-sidebar-muted">
            Operational workspace
          </p>
        </div>
      </div>

      <nav
        aria-label="Primary navigation"
        className="scroll-dark flex-1 overflow-y-auto px-3 pb-3"
      >
        <ul className="space-y-1">
          {mainItems.map((item) => (
            <NavItemLink
              item={item}
              key={item.path}
              onNavigate={onNavigate}
            />
          ))}
        </ul>

        {utilityItems.length > 0 ? (
          <>
            <div className="mx-3 my-4 border-t border-sidebar-line" />
            <ul className="space-y-1">
              {utilityItems.map((item) => (
                <NavItemLink
                  item={item}
                  key={item.path}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </>
        ) : null}

        <div className="mt-6 space-y-1">
          <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-sidebar-muted">
            Coming soon
          </p>
          {FUTURE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <span
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-3.5 rounded-full px-4 py-2.5 text-[14px] font-semibold text-sidebar-muted/60"
                key={item.label}
              >
                <Icon aria-hidden="true" className="h-[20px] w-[20px]" />
                {item.label}
              </span>
            );
          })}
        </div>
      </nav>

      {/* Profile + logout in the rail. */}
      {user ? (
        <div className="space-y-2 border-t border-sidebar-line px-4 py-4">
          <div className="flex items-center gap-3 rounded-2xl bg-sidebar-raised p-3">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lilac text-sm font-bold text-lilac-ink"
            >
              {initials(displayName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white">
                {displayName}
              </p>
              <p className="truncate text-[11px] font-medium text-sidebar-muted">
                {user.role ?? "No role"} · {scopeLabel(user)}
              </p>
            </div>
          </div>
          <button
            aria-label="Logout"
            className="flex w-full items-center gap-3.5 rounded-full px-4 py-3 text-[15px] font-semibold text-sidebar-text/85 outline-none transition-colors duration-200 ease-soft hover:bg-sidebar-raised hover:text-white focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            onClick={() => void handleLogout()}
            type="button"
          >
            <LogOut aria-hidden="true" className="h-[20px] w-[20px] text-sidebar-muted" />
            Log out
          </button>
        </div>
      ) : null}
    </aside>
  );
}
