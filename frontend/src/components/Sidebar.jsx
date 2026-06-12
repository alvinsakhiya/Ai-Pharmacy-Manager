import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  AlertTriangle,
  Brain,
  LogOut,
  Pill,
  X,
} from "lucide-react";
import useAuth from "../hooks/useAuth";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Patients", icon: Users, path: "/patients" },
  { name: "Inventory", icon: Package, path: "/inventory" },
  { name: "Dosette", icon: ClipboardList, path: "/dosette" },
  { name: "Picking Lists", icon: ClipboardList, path: "/picking-lists" },
  { name: "Alerts", icon: AlertTriangle, path: "/alerts" },
  { name: "AI Forecasting", icon: Brain, path: "/forecasts" },
];

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    onClose();
    navigate("/login", { replace: true });
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-400 text-slate-950 shadow-lg shadow-teal-950/20">
              <Pill size={23} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-white">PharmaCare</p>
              <p className="text-xs font-medium text-slate-400">Stock & Dosette System</p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-3 pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4" aria-label="Primary navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-teal-400 text-slate-950 shadow-sm"
                      : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`
                }
              >
                <Icon size={19} strokeWidth={2} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-xl bg-white/5 px-4 py-3">
            <p className="text-sm font-semibold text-white">Pharmacy workspace</p>
            <p className="mt-0.5 text-xs text-slate-400">Secure staff session</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={19} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
