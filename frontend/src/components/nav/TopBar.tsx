import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { NotificationCentre } from "../../features/notifications/NotificationCentre";
import { scopeLabel } from "../../lib/scope";

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  if (!user) {
    return null;
  }

  const displayName = user.full_name || user.email;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Open navigation"
          className="app-shell__menu-button rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          onClick={onMenuClick}
          type="button"
        >
          Menu
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">
            AI Pharmacy Manager
          </p>
          <p className="truncate text-sm text-slate-500">{scopeLabel(user)}</p>
        </div>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center px-6 lg:flex">
        <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 shadow-sm">
          Search users, medications, patients, reports...
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationCentre />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-950">
            {displayName}
          </p>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {user.role ?? "No role"}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="hidden h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white shadow-sm sm:flex"
        >
          {initials || "U"}
        </div>
        <button
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          onClick={() => void handleLogout()}
          type="button"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
