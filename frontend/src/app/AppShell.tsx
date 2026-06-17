import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "../components/nav/Sidebar";
import { TopBar } from "../components/nav/TopBar";

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:block">
        <Sidebar />
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
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

      <div className="md:pl-72">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
