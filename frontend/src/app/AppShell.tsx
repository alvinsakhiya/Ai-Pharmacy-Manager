import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "../components/nav/Sidebar";
import { TopBar } from "../components/nav/TopBar";

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-muted text-slate-950">
      <div className="app-shell__desktop-sidebar">
        <Sidebar />
      </div>

      {mobileNavOpen ? (
        <div className="app-shell__mobile-overlay fixed inset-0 z-40">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileNavOpen(false)}
            type="button"
          />
          <div className="relative h-full max-w-72 shadow-2xl">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="app-shell__content">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
