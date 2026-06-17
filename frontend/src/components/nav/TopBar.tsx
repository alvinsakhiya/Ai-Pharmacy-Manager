import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
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

  return (
    <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Open navigation"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 md:hidden"
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

      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-950">
            {user.full_name || user.email}
          </p>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {user.role ?? "No role"}
          </p>
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
