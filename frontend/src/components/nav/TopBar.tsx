import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Building2, CalendarDays, Menu } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { NotificationCentre } from "../../features/notifications/NotificationCentre";
import { NAV_ITEMS } from "../../app/navConfig";
import { cn } from "../../lib/cn";
import { scopeLabel } from "../../lib/scope";

interface TopBarProps {
  onMenuClick?: () => void;
}

function useSectionTitle(): string {
  const { pathname } = useLocation();
  const match = NAV_ITEMS.filter((item) =>
    item.path === "/" ? pathname === "/" : pathname.startsWith(item.path),
  ).sort((a, b) => b.path.length - a.path.length)[0];
  return match?.label ?? "Workspace";
}

function useTopBarScrolled(): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function updateScrolled() {
      setIsScrolled(window.scrollY > 8);
    }

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  return isScrolled;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuth();
  const section = useSectionTitle();
  const isScrolled = useTopBarScrolled();
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date());

  if (!user) {
    return null;
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b bg-canvas transition-[border-color,box-shadow] duration-200 ease-soft",
        isScrolled
          ? "border-line shadow-[0_14px_30px_rgba(42,35,64,0.06)]"
          : "border-line shadow-none",
      )}
    >
      <div className="mx-auto flex min-h-[68px] max-w-[1480px] items-center gap-2.5 px-4 py-3.5 sm:px-6 sm:gap-3 lg:px-8">
        <button
          aria-label="Open navigation"
          className="app-shell__menu-button grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft shadow-elev-1 transition-colors hover:bg-surface-subtle focus-ring"
          onClick={onMenuClick}
          type="button"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Workspace
          </p>
          <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">
            {section}
          </p>
        </div>

        <div className="hidden h-10 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-4 shadow-elev-1 sm:flex">
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-brand" />
          <span className="text-[13px] font-bold text-ink">{today}</span>
        </div>

        <div className="hidden h-10 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-4 shadow-elev-1 md:flex">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"
          >
            <Building2 className="h-3.5 w-3.5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted">
              Scope
            </span>
            <span className="mt-0.5 max-w-[12rem] truncate text-[13px] font-bold text-ink">
              {scopeLabel(user)}
            </span>
          </span>
        </div>

        <NotificationCentre />
      </div>
    </header>
  );
}
