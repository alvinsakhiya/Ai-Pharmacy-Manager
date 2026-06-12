import { useEffect, useRef } from "react";
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
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen && !window.matchMedia("(min-width: 1024px)").matches) {
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [isOpen]);

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
        className={`liquid-sidebar print-hidden fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col overflow-hidden text-slate-700 shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute -right-24 top-20 h-56 w-56 rounded-full bg-blue-400/14 blur-3xl" />

        <div className="relative border-b border-slate-200/55 px-4 pb-4 pt-3.5">
          <div aria-hidden="true" className="mb-4 flex items-center gap-2 px-1">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57] shadow-inner" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e] shadow-inner" />
            <span className="h-3 w-3 rounded-full bg-[#28c840] shadow-inner" />
          </div>

          <div className="flex items-center justify-between">
            <BrandMark compact />
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close navigation"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/60 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 lg:hidden"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative px-5 pb-2 pt-5">
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
                  `group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 ${
                    isActive
                      ? "bg-blue-500/12 text-blue-700 shadow-sm ring-1 ring-blue-500/10"
                      : "text-slate-500 hover:bg-white/55 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-blue-500" />
                    )}
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                        isActive
                          ? "bg-blue-500 text-white shadow-sm shadow-blue-500/25"
                          : "bg-white/45 text-slate-400 ring-1 ring-slate-200/60 group-hover:text-blue-600"
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

        <div className="relative border-t border-slate-200/55 p-4">
          <div className="mb-3 rounded-2xl border border-white/75 bg-white/42 p-3.5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-900">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">Protected staff session</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck aria-hidden="true" size={12} />
                  Secure JWT session active
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-500 transition hover:bg-red-500/8 hover:text-red-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-400/20"
          >
            <LogOut size={18} />
            Sign out
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
            <CalendarDays size={12} />
            Pharmacy operations
          </p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
