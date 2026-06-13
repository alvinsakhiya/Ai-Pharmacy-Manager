/**
 * Patients (admin only) — full patient list with search and record management.
 *
 * Non-admin staff don't get a patient list at all; they reach patients via the
 * top search bar. This page is the administrator's overview of every patient.
 */
import { useMemo, useState } from "react";
import { Search, UserRound, ShieldAlert, CalendarClock, MapPin, IdCard } from "lucide-react";
import { Card, StatusChip, EmptyState, Input } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { PATIENTS, searchPatients, fmtDate } from "../services/patientData";
import PatientRecord from "../components/patients/PatientRecord";

export default function Patients() {
  const { can } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const isAdmin = can("administrator");
  const rows = useMemo(
    () => (query.trim() ? searchPatients(query) : [...PATIENTS].sort((a, b) => a.surname.localeCompare(b.surname))),
    [query]
  );

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={ShieldAlert}
          title="Patient list is administrator-only"
          hint="Use the patient search at the top of the screen to find and open a patient record."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display font-semibold tracking-tight">Patients</h1>
          <p className="mt-1 text-body text-text-secondary">{PATIENTS.length} patient records · administrator view</p>
        </div>
      </header>

      <Card className="flex items-center gap-2 p-3">
        <Search size={16} className="text-text-tertiary" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, initials, DOB, postcode or ID…"
          aria-label="Filter patients"
          className="border-0 px-0 focus:ring-0"
        />
      </Card>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={UserRound} title="No matching patients" hint="Adjust your search." />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {rows.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelected(p)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent-ring"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-body font-semibold text-accent" aria-hidden="true">
                    {p.firstName[0]}{p.surname[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-semibold text-text-primary">{p.name}</span>
                      <StatusChip tone={p.status === "active" ? "success" : "neutral"} icon={false}>
                        {p.status === "active" ? "Active" : "Inactive"}
                      </StatusChip>
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-caption text-text-tertiary tnum">
                      <span className="inline-flex items-center gap-1"><IdCard size={13} aria-hidden="true" />{p.id}</span>
                      <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden="true" />{fmtDate(p.dob)} ({p.age})</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden="true" />{p.postcode}</span>
                    </span>
                  </span>
                  <span className="hidden text-caption text-text-tertiary md:block">{p.doctor.practice}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PatientRecord patient={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
