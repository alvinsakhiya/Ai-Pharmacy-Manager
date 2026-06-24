import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search } from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { NAV_ITEMS } from "../../app/navConfig";
import { cn } from "../../lib/cn";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ⌘K command surface. Lists the permission-filtered modules and navigates on
 * select. Opens via the topbar trigger or the global ⌘K / Ctrl+K shortcut.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const modules = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) =>
          !item.requiredAnyOf ||
          item.requiredAnyOf.some((permission) => can(permission)),
      ),
    [can],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return modules;
    }
    return modules.filter((item) => item.label.toLowerCase().includes(q));
  }, [modules, query]);

  // Global shortcut to toggle the palette.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) {
    return null;
  }

  function go(path: string) {
    onOpenChange(false);
    navigate(path);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onOpenChange(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[active];
      if (target) {
        go(target.path);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in items-start justify-center bg-ink/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Command menu"
        className="w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface shadow-elev-3"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
          <input
            ref={inputRef}
            aria-label="Search modules"
            className="h-12 w-full rounded-lg bg-transparent text-sm text-ink outline-none placeholder:text-muted focus-ring"
            placeholder="Search modules…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-bold text-muted">
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted">
              No modules match “{query}”.
            </li>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              const isActive = index === active;
              return (
                <li key={item.path}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item.path)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-left text-sm font-semibold transition-all duration-200 ease-soft active:scale-[0.99] focus-ring",
                      isActive
                        ? "bg-brand-soft text-brand-ink"
                        : "text-ink-soft hover:bg-surface-subtle",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        isActive ? "text-brand" : "text-muted",
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {isActive ? (
                      <CornerDownLeft
                        aria-hidden="true"
                        className="h-4 w-4 text-brand"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
