import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Sidebar } from "../components/nav/Sidebar";
import { TopBar } from "../components/nav/TopBar";

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-shell__desktop-sidebar">
        <Sidebar />
      </div>

      {mobileNavOpen ? (
        <div className="app-shell__mobile-overlay fixed inset-0 z-40">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
            type="button"
          />
          <div className="relative h-full w-[16.5rem] max-w-[85vw] animate-slide-in-left shadow-elev-3">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="app-shell__content">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1480px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          {/* Re-key on route change so every page settles in with the same
              calm entrance (respects reduced-motion via index.css). */}
          <div className="page-enter" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
