import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, Menu, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BrandMark from "../components/BrandMark";
import WorkspaceSearch from "../components/WorkspaceSearch";
import useAuth from "../hooks/useAuth";

const desktopNavigationQuery = "(min-width: 1024px)";
const pageNames = {
  "/": "Dashboard",
  "/patients": "Patients",
  "/inventory": "Inventory",
  "/stock-movements": "Stock Movements",
  "/clinical-reviews": "Clinical Reviews",
  "/notifications": "Notification Centre",
  "/dosette": "Dosette Management",
  "/picking-lists": "Picking Lists",
  "/alerts": "Expiry Alerts",
  "/forecasts": "AI Forecasting",
  "/stock-intelligence": "Stock Intelligence",
  "/ordering": "Suppliers & Draft Orders",
  "/operations": "Pharmacy Operations",
  "/deliveries": "Local Deliveries",
  "/reports": "Reports",
  "/audit-log": "Audit History",
};

function MainLayout({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const pageName = pageNames[location.pathname] || "Clinical Operations";
  const initialDesktopState = window.matchMedia(desktopNavigationQuery).matches;
  const [isDesktop, setIsDesktop] = useState(initialDesktopState);
  const [isNavigationOpen, setIsNavigationOpen] = useState(initialDesktopState);
  const navigationButtonRef = useRef(null);

  useEffect(() => {
    document.title = `${pageName} · PharmaCare`;
  }, [pageName]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(desktopNavigationQuery);
    const handleViewportChange = (event) => {
      setIsDesktop(event.matches);
      setIsNavigationOpen(event.matches);
    };

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    if (!isDesktop && isNavigationOpen) {
      document.body.style.overflow = "hidden";
    }

    const handleEscape = (event) => {
      if (event.key === "Escape" && !isDesktop) {
        setIsNavigationOpen(false);
        window.requestAnimationFrame(() => navigationButtonRef.current?.focus());
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isDesktop, isNavigationOpen]);

  const closeNavigation = () => {
    if (!isDesktop) {
      setIsNavigationOpen(false);
      window.requestAnimationFrame(() => navigationButtonRef.current?.focus());
    }
  };

  return (
    <div className="app-shell flex min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xl transition focus:translate-y-0"
      >
        Skip to main content
      </a>

      <Sidebar
        isOpen={isNavigationOpen}
        onClose={closeNavigation}
      />

      <div
        className="min-w-0 flex-1"
        inert={!isDesktop && isNavigationOpen ? true : undefined}
      >
        <header className="liquid-toolbar print-hidden sticky top-0 z-20 flex h-16 items-center justify-between px-4 sm:px-6 lg:hidden">
          <button
            ref={navigationButtonRef}
            type="button"
            aria-label="Open navigation"
            aria-controls="primary-navigation"
            aria-expanded={isNavigationOpen}
            className="glass-icon-button"
            onClick={() => setIsNavigationOpen(true)}
          >
            <Menu size={20} />
          </button>

          <BrandMark compact />

          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50/70 text-emerald-700 shadow-sm backdrop-blur-xl"
            aria-label="Secure session active"
            title="Secure session active"
          >
            <ShieldCheck size={18} />
          </div>
        </header>

        <div className="liquid-toolbar print-hidden sticky top-0 z-20 hidden h-[4.5rem] items-center gap-6 px-7 lg:flex xl:px-9">
          <nav className="min-w-48" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-xs font-semibold">
              <li className="text-slate-400">Workspace</li>
              <li aria-hidden="true" className="text-slate-300">
                <ChevronRight size={13} />
              </li>
              <li aria-current="page" className="text-slate-700">
                {pageName}
              </li>
            </ol>
          </nav>

          <div className="flex flex-1 justify-center">
            <WorkspaceSearch />
          </div>

          <div className="flex min-w-48 items-center justify-end gap-2">
            <Link
              to="/notifications"
              aria-label="Open notification centre"
              className="glass-icon-button"
            >
              <Bell aria-hidden="true" size={18} />
            </Link>
            <div className="flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/45 py-1.5 pl-2 pr-3 shadow-sm backdrop-blur-xl">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-violet-500 text-white shadow-sm">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="max-w-32 truncate text-xs font-bold text-slate-800">
                  {user?.display_name || "Pharmacy Staff"}
                </p>
                <p className="max-w-32 truncate text-[10px] font-medium text-slate-400">
                  {user?.primary_role || "Secure session"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <main
          id="main-content"
          className="relative mx-auto w-full max-w-[1680px] p-4 sm:p-6 lg:p-7 xl:p-9"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
