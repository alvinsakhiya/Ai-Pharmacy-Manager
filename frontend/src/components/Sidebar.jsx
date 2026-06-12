import { NavLink, useNavigate } from "react-router-dom";
import {
  BrainCircuit,
  CalendarDays,
  ClipboardCheck,
  Grid2X2,
  LayoutDashboard,
  PackageOpen,
  ShieldCheck,
  TriangleAlert,
  Users,
  LogOut,
  X,
} from "lucide-react";
import useAuth from "../hooks/useAuth";
import BrandMark from "./BrandMark";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Patients", icon: Users, path: "/patients" },
  { name: "Inventory", icon: PackageOpen, path: "/inventory" },
  { name: "Dosette", icon: Grid2X2, path: "/dosette" },
  { name: "Picking Lists", icon: ClipboardCheck, path: "/picking-lists" },
  { name: "Expiry Alerts", icon: TriangleAlert, path: "/alerts" },
  { name: "AI Forecasting", icon: BrainCircuit, path: "/forecasts" },
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
          aria-label="Dismiss navigation"
          className="fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="primary-navigation"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`subtle-grid fixed inset-y-0 left-0 z-40 flex w-[18rem] flex-col overflow-hidden bg-[#07111f] text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute -right-24 top-20 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative flex items-center justify-between border-b border-white/8 px-5 py-5">
          <BrandMark compact inverse />

          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-400/20 lg:hidden"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative px-5 pb-3 pt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Clinical workspace
          </p>
        </div>

        <nav
          className="scrollbar-thin relative flex-1 space-y-1 overflow-y-auto px-3"
          aria-label="Primary navigation"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-400/20 ${
                    isActive
                      ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
                      : "text-slate-400 hover:bg-white/6 hover:text-slate-100"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-teal-400" />
                    )}
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        isActive
                          ? "bg-teal-400 text-slate-950"
                          : "bg-white/5 text-slate-400 group-hover:text-teal-300"
                      }`}
                    >
                      <Icon size={17} strokeWidth={2} />
                    </span>
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="relative border-t border-white/8 p-4">
          <div className="mb-3 rounded-2xl border border-white/8 bg-white/[0.04] p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">Protected staff session</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  JWT authentication active
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-400/20"
          >
            <LogOut size={18} />
            Sign out
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-600">
            <CalendarDays size={12} />
            Pharmacy operations
          </p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
