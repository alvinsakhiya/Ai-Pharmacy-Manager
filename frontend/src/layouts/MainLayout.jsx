import { useEffect, useState } from "react";
import { Menu, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import BrandMark from "../components/BrandMark";

const desktopNavigationQuery = "(min-width: 1024px)";
const pageNames = {
  "/": "Dashboard",
  "/patients": "Patients",
  "/inventory": "Inventory",
  "/dosette": "Dosette Management",
  "/picking-lists": "Picking Lists",
  "/alerts": "Expiry Alerts",
  "/forecasts": "AI Forecasting",
};

function MainLayout({ children }) {
  const location = useLocation();
  const [isNavigationOpen, setIsNavigationOpen] = useState(() =>
    window.matchMedia(desktopNavigationQuery).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(desktopNavigationQuery);
    const handleViewportChange = (event) => setIsNavigationOpen(event.matches);

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    const isDesktop = window.matchMedia(desktopNavigationQuery).matches;

    if (!isDesktop && isNavigationOpen) {
      document.body.style.overflow = "hidden";
    }

    const handleEscape = (event) => {
      if (event.key === "Escape" && !isDesktop) {
        setIsNavigationOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isNavigationOpen]);

  const closeNavigation = () => {
    if (!window.matchMedia(desktopNavigationQuery).matches) {
      setIsNavigationOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-xl transition focus:translate-y-0"
      >
        Skip to main content
      </a>

      <Sidebar
        isOpen={isNavigationOpen}
        onClose={closeNavigation}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            aria-controls="primary-navigation"
            aria-expanded={isNavigationOpen}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20"
            onClick={() => setIsNavigationOpen(true)}
          >
            <Menu size={20} />
          </button>

          <BrandMark compact />

          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700"
            aria-label="Secure session active"
            title="Secure session active"
          >
            <ShieldCheck size={18} />
          </div>
        </header>

        <div className="hidden h-14 items-center justify-between border-b border-slate-200/70 bg-white/55 px-8 backdrop-blur lg:flex">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            {pageNames[location.pathname] || "Clinical Operations"}
          </p>
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
            Systems operational
          </p>
        </div>

        <main
          id="main-content"
          className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 lg:p-8 xl:p-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
