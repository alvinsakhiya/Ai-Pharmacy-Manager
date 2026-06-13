/**
 * PatientSearchBar — the primary way staff reach a patient (top bar), mirroring
 * a real pharmacy system. Typeahead with a results dropdown; multi-format match
 * (full/first/last name, initials + surname, partial, DOB, postcode, patient ID).
 *
 * Accessible combobox: ARIA roles, keyboard navigation (↑/↓/Enter/Esc), a live
 * result count for screen readers. Never auto-opens the first match — staff
 * always choose, to avoid picking the wrong patient.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Search, X, UserRound, CalendarClock, MapPin, IdCard, Stethoscope } from "lucide-react";
import { StatusChip, cx } from "../ui";
import { searchPatients, fmtDate } from "../../services/patientData";
import PatientRecord from "./PatientRecord";

export default function PatientSearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(null);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  const results = query.trim() ? searchPatients(query) : [];

  // Close on outside click.
  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => setActive(0), [query]);

  const choose = (p) => {
    setSelected(p);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) setOpen(true);
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { if (open && results[active]) { e.preventDefault(); choose(results[active]); } }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex h-9 items-center gap-2 rounded-md border border-border-subtle bg-app px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-ring">
        <Search size={16} className="text-text-tertiary" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={onKeyDown}
          type="text"
          role="combobox"
          aria-label="Search for a patient by name, date of birth, postcode or ID"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          placeholder="Search for a patient…  name · DOB · postcode · ID"
          className="h-full flex-1 bg-transparent text-body text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear" className="rounded p-0.5 text-text-tertiary hover:bg-subtle">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Screen-reader live count */}
      <span className="sr-only" aria-live="polite">
        {query.trim() ? `${results.length} ${results.length === 1 ? "patient" : "patients"} found` : ""}
      </span>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-elev-3 animate-slide-up">
          {results.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-4 text-text-secondary">
              <UserRound size={18} className="text-text-tertiary" aria-hidden="true" />
              <div>
                <div className="text-body font-medium text-text-primary">No matching patients</div>
                <div className="text-caption text-text-tertiary">Try a date of birth, postcode or patient ID.</div>
              </div>
            </div>
          ) : (
            <ul role="listbox" id={listId} aria-label="Patient results" className="max-h-[60vh] overflow-y-auto py-1">
              {results.map((p, i) => (
                <li
                  key={p.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                  className={cx(
                    "flex cursor-pointer items-center gap-3 px-3 py-2.5",
                    i === active ? "bg-accent-soft" : "hover:bg-subtle"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-caption font-semibold text-text-secondary" aria-hidden="true">
                    {p.firstName[0]}{p.surname[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-body font-semibold text-text-primary">{p.name}</span>
                      <StatusChip tone={p.status === "active" ? "success" : "neutral"} icon={false}>
                        {p.status === "active" ? "Active" : "Inactive"}
                      </StatusChip>
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-text-tertiary tnum">
                      <span className="inline-flex items-center gap-1"><CalendarClock size={12} aria-hidden="true" />{fmtDate(p.dob)}</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{p.postcode}</span>
                      <span className="inline-flex items-center gap-1"><IdCard size={12} aria-hidden="true" />{p.id}</span>
                      <span className="inline-flex items-center gap-1"><Stethoscope size={12} aria-hidden="true" />{p.doctor.practice}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border-subtle bg-app/60 px-3 py-1.5 text-[11px] text-text-tertiary">
            Use ↑ ↓ to navigate · Enter to open · matches name, initials, DOB, postcode or ID
          </div>
        </div>
      )}

      <PatientRecord patient={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
