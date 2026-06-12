import { useEffect, useState } from "react";
import { Menu, ShieldCheck } from "lucide-react";
import Sidebar from "../components/Sidebar";

const desktopNavigationQuery = "(min-width: 1024px)";

function MainLayout({ children }) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(() =>
    window.matchMedia(desktopNavigationQuery).matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(desktopNavigationQuery);
    const handleViewportChange = (event) => setIsNavigationOpen(event.matches);

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  const closeNavigation = () => {
    if (!window.matchMedia(desktopNavigationQuery).matches) {
      setIsNavigationOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        isOpen={isNavigationOpen}
        onClose={closeNavigation}
      />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={() => setIsNavigationOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ShieldCheck size={18} className="text-teal-600" />
            Secure workspace
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
