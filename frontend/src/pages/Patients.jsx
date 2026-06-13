/**
 * Patients — search-first lookup workflow.
 *
 * No list is shown by default; staff search (by name, initials, partial name,
 * date of birth, postcode or patient ID) and pick the right record, exactly like
 * a real community-pharmacy patient lookup. Selecting a result opens the full
 * tabbed Patient Record.
 */
import { useMemo, useRef, useState } from "react";
import { Search, UserRound, CalendarClock, MapPin, IdCard, X } from "lucide-react";
import { Card, StatusChip, EmptyState, cx } from "../components/ui";
import { searchPatients, fmtDate, STATUS_TONE } from "../services/patientData";
import PatientRecord from "../components/patients/PatientRecord";

const EXAMPLES = ["Alvin Sakhiya", "A Sakhiya", "Al Sa", "PT-10428", "LE3 9QP"];

function initialsOf(p) {
  return `${p.firstName[0]}${p.surname[0]}`.toUpperCase();
}

export default function Patients() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);

  const results = useMemo(() => searchPatients(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="text-center">
        <h1 className="text-display font-semibold tracking-tight">Patient lookup</h1>
        <p className="mt-1 text-body text-text-secondary">
          Search by name, initials, date of birth, postcode or patient ID.
        </p>
      </header>

      {/* Search bar */}
      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          type="search"
          aria-label="Search patients"
          placeholder="e.g. Alvin Sakhiya · A Sa · 26/03/1991 · LE3 9QP · PT-10428"
          className="h-14 w-full rounded-2xl border border-border-strong bg-surface pl-12 pr-12 text-subtitle text-text-primary shadow-elev-1 placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-tertiary hover:bg-subtle"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Idle: example chips + guidance */}
      {!searching && (
        <div className="animate-fade-in">
          <p className="mb-2 text-center text-caption text-text-tertiary">Try one of these</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuery(ex)}
                className="rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-caption font-medium text-text-secondary transition hover:border-accent hover:text-accent active:scale-[0.98]"
              >
                {ex}
              </button>
            ))}
          </div>
          <Card className="mt-6">
            <EmptyState icon={UserRound} title="Start typing to find a patient" hint="Matches partial names and initials — “Al Sa” finds “Alvin Sakhiya”." />
          </Card>
        </div>
      )}

      {/* Results */}
      {searching && (
        <div aria-live="polite" className="space-y-2">
          <p className="px-1 text-caption text-text-tertiary">
            {results.length} {results.length === 1 ? "match" : "matches"} for “{query}”
          </p>
          {results.length === 0 ? (
            <Card>
              <EmptyState icon={Search} title="No matching patients" hint="Check the spelling, or try a date of birth, postcode or patient ID." />
            </Card>
          ) : (
            <ul className="space-y-2">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelected(p)}
                    className="group flex w-full items-center gap-4 rounded-xl border border-border-subtle bg-surface p-3.5 text-left shadow-elev-1 transition-all duration-150 ease hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-elev-2 focus-visible:ring-2 focus-visible:ring-accent-ring active:scale-[0.995]"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-subtitle font-semibold text-accent" aria-hidden="true">
                      {initialsOf(p)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-subtitle font-semibold text-text-primary">{p.name}</span>
                        {p.packType?.includes("compliance") && (
                          <StatusChip tone="info" icon={false} dot>Dosette</StatusChip>
                        )}
                        <StatusChip tone={STATUS_TONE[p.workflow.status]} icon={false}>{p.workflow.status}</StatusChip>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-caption text-text-tertiary tnum">
                        <span className="inline-flex items-center gap-1"><IdCard size={13} aria-hidden="true" />{p.id}</span>
                        <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden="true" />{fmtDate(p.dob)} ({p.age})</span>
                        <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden="true" />{p.postcode}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <PatientRecord patient={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
