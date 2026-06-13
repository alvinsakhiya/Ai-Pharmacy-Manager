import { useEffect, useRef, useState } from "react";
import { Command, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { canAccessPath } from "../utils/access";

const workspaceDestinations = [
  { label: "Dashboard", keywords: "overview home metrics", path: "/" },
  { label: "Patients", keywords: "patient records care", path: "/patients" },
  { label: "Inventory", keywords: "medication stock batches supplier", path: "/inventory" },
  { label: "Stock Movements", keywords: "ledger adjustment receipt waste correction", path: "/stock-movements" },
  { label: "Clinical Reviews", keywords: "patient note follow up pharmacist review", path: "/clinical-reviews" },
  { label: "Notifications", keywords: "inbox task acknowledge resolve priority", path: "/notifications" },
  { label: "Dosette", keywords: "schedule doses morning evening", path: "/dosette" },
  { label: "Picking Lists", keywords: "fefo allocation shortfall", path: "/picking-lists" },
  { label: "Expiry Alerts", keywords: "expired risk safety", path: "/alerts" },
  { label: "AI Forecasting", keywords: "forecast demand reorder risk", path: "/forecasts" },
  { label: "Stock Intelligence", keywords: "minimum threshold cover low excess inactive dead stock", path: "/stock-intelligence" },
  { label: "Suppliers & Drafts", keywords: "supplier reorder purchasing internal draft order", path: "/ordering" },
  { label: "Operations", keywords: "tasks opening hours claim start complete workflow", path: "/operations" },
  { label: "Local Deliveries", keywords: "patient delivery planned ready dispatch failed local", path: "/deliveries" },
  { label: "Reports", keywords: "csv export evidence stock expiry forecast audit notifications picking", path: "/reports" },
  { label: "Audit History", keywords: "governance activity trace staff actions", path: "/audit-log" },
];

function WorkspaceSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const authorisedDestinations = workspaceDestinations.filter((destination) =>
    canAccessPath(user, destination.path)
  );
  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery
    ? authorisedDestinations.filter(({ keywords, label }) =>
        `${label} ${keywords}`.toLowerCase().includes(normalizedQuery)
      )
    : authorisedDestinations;

  const openDestination = (destination) => {
    navigate(destination.path);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-full max-w-xl">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400"
        size={17}
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        aria-label="Search workspace navigation"
        aria-expanded={isOpen}
        aria-controls="workspace-search-results"
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Search workspace..."
        className="liquid-search h-10 w-full rounded-xl py-2 pl-10 pr-16 text-sm text-slate-700 placeholder:text-slate-400"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && matches[0]) {
            event.preventDefault();
            openDestination(matches[0]);
          }
          if (event.key === "Escape") {
            setIsOpen(false);
            inputRef.current?.blur();
          }
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md border border-white/70 bg-white/55 px-1.5 py-1 text-[10px] font-bold text-slate-400 shadow-sm">
        <Command size={10} />
        K
      </span>

      {isOpen && (
        <div
          id="workspace-search-results"
          className="liquid-popover absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl p-1.5"
          role="group"
          aria-label="Workspace search suggestions"
        >
          {matches.length ? (
            matches.slice(0, 6).map((destination) => (
              <button
                key={destination.path}
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-blue-500/10 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => openDestination(destination)}
              >
                {destination.label}
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Open
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-sm text-slate-500">
              No workspace destination found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default WorkspaceSearch;
