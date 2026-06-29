import { Search } from "lucide-react";

import type { SearchSuggestion } from "../../lib/smartSearch";

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  onPick: (suggestion: SearchSuggestion) => void;
  label?: string;
  onClose?: () => void;
}

export function SearchSuggestions({
  suggestions,
  onPick,
  label = "Search suggestions",
  onClose,
}: SearchSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-elev-1"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose?.();
        }
      }}
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface-subtle px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        <Search aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </div>
      <ul
        aria-label={label}
        className="max-h-56 overflow-y-auto p-1"
        role="listbox"
      >
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <button
              className="flex w-full min-w-0 flex-col rounded-lg px-3 py-2 text-left transition-colors duration-150 ease-soft hover:bg-surface-subtle focus-ring"
              onClick={() => onPick(suggestion)}
              type="button"
            >
              <span className="truncate text-sm font-bold text-ink">
                {suggestion.label}
              </span>
              {suggestion.description ? (
                <span className="mt-0.5 truncate text-xs font-medium text-muted">
                  {suggestion.description}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
