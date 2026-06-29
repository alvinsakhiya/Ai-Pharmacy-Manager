import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { FUTURE_ITEMS, NAV_ITEMS, type NavItem } from "../../app/navConfig";
import { scopeLabel } from "../../lib/scope";
import { cn } from "../../lib/cn";
import { useWorkQueueQuery } from "../../features/notifications/useNotifications";
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
  badgeCount,
}: {
  item: NavItem;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        className={({ isActive }) =>
          cn(
            "group relative flex items-center gap-3.5 rounded-full px-4 py-3 text-[15px] font-semibold outline-none transition-all duration-200 ease-soft active:scale-[0.98]",
            "focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
            isActive
              ? "bg-gradient-lilac text-lilac-ink shadow-[0_8px_22px_-8px_rgba(201,182,246,0.7)] ring-1 ring-inset ring-lilac"
              : "text-sidebar-text/80 hover:translate-x-1 hover:bg-sidebar-raised hover:text-white",
          )
        }
        end={item.path === "/"}
        onClick={onNavigate}
        to={item.path}
      >
        {({ isActive }) => (
          <>
            {/* "You are here" anchor — a lilac bar that grows in beside the
                active pill. Decorative, so hidden from assistive tech. */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-1/2 h-6 w-1 -translate-x-2 -translate-y-1/2 rounded-full bg-lilac transition-all duration-300 ease-soft",
                isActive ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
              )}
            />
            <Icon
              aria-hidden="true"
              className={cn(
                "h-[20px] w-[20px] shrink-0 transition-transform duration-200 ease-soft",
                isActive
                  ? "animate-pop text-lilac-ink"
                  : "text-sidebar-muted group-hover:-rotate-6 group-hover:scale-110 group-hover:text-white group-active:scale-95",
              )}
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {badgeCount !== undefined && badgeCount > 0 ? (
              <span
                aria-label={`${badgeCount} tasks`}
                className={cn(
                  "tnum ml-auto inline-flex min-w-6 shrink-0 animate-scale-in items-center justify-center rounded-full px-2 py-0.5 text-xs font-extrabold transition-colors duration-200",
                  isActive
                    ? "bg-surface text-lilac-ink"
                    : "bg-lilac text-lilac-ink shadow-[0_2px_12px_rgba(201,182,246,0.55)]",
                )}
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            ) : null}
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
  const canOpenWorkQueue =
    can("stock.view") || can("blister.view") || can("review.view");
  const workQueueQuery = useWorkQueueQuery({ enabled: canOpenWorkQueue });
  const workQueueCount = workQueueQuery.data?.summary.total ?? 0;

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
    <aside className="relative isolate flex h-full w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#2f2846_0%,#2a2340_45%,#211c34_100%)] text-sidebar-text">
      <div className="group/brand flex animate-fade-in items-center gap-3 px-6 py-6">
        <span className="transition-transform duration-300 ease-soft group-hover/brand:scale-105">
          <Logo size={44} />
        </span>
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
        <ul className="stagger space-y-1">
          {mainItems.map((item) => (
            <NavItemLink
              badgeCount={
                item.path === "/work-queue" ? workQueueCount : undefined
              }
              item={item}
              key={item.path}
              onNavigate={onNavigate}
            />
          ))}
        </ul>

        {utilityItems.length > 0 ? (
          <>
            <div className="mx-3 my-4 border-t border-sidebar-line" />
            <ul className="stagger space-y-1">
              {utilityItems.map((item) => (
                <NavItemLink
                  badgeCount={
                    item.path === "/work-queue" ? workQueueCount : undefined
                  }
                  item={item}
                  key={item.path}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </>
        ) : null}

        {FUTURE_ITEMS.length > 0 ? (
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
        ) : null}
      </nav>

      {/* Profile + logout in the rail. */}
      {user ? (
        <div className="animate-slide-up space-y-2 border-t border-sidebar-line px-4 py-4">
          <div className="flex items-center gap-3 rounded-2xl bg-sidebar-raised p-3 ring-1 ring-inset ring-sidebar-line transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:bg-sidebar-line hover:shadow-elev-2">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-lilac text-sm font-bold text-lilac-ink shadow-[0_4px_14px_-4px_rgba(201,182,246,0.7)] ring-2 ring-inset ring-lilac"
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
            className="group flex w-full items-center gap-3.5 rounded-full px-4 py-3 text-[15px] font-semibold text-sidebar-text/80 outline-none transition-all duration-200 ease-soft hover:bg-sidebar-raised hover:text-white focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar active:scale-[0.98]"
            onClick={() => void handleLogout()}
            type="button"
          >
            <LogOut
              aria-hidden="true"
              className="h-[20px] w-[20px] text-sidebar-muted transition-transform duration-200 ease-soft group-hover:translate-x-0.5 group-hover:text-white"
            />
            Log out
          </button>
        </div>
      ) : null}
    </aside>
  );
}
