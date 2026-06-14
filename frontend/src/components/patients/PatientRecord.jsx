/**
 * PatientRecord — tabbed patient record (patient workflow only for now).
 *
 * Tabs: Patient · Doctor · Medication · History · Notes. Mirrors a real pharmacy
 * "patient details" record. Accessible tabs (role=tablist, keyboard, aria-selected);
 * colour never the only signal. Simulated data — academic demonstration, not
 * clinical advice, and no NHS data/branding.
 */
import { useEffect, useState } from "react";
import {
  User, Stethoscope, Pill, LayoutGrid, History, StickyNote, CalendarClock, MapPin, ChevronDown,
} from "lucide-react";
import { Card, StatusChip, EmptyState, Modal, cx } from "../ui";
import { getMedicationHistory, fmtDate } from "../../services/patientData";
import DosetteTab from "./DosetteTab";

const TABS = [
  { id: "patient", label: "Patient", icon: User },
  { id: "doctor", label: "Doctor", icon: Stethoscope },
  { id: "medication", label: "Medication", icon: Pill },
  { id: "dosette", label: "Dosette", icon: LayoutGrid },
  { id: "history", label: "History", icon: History },
  { id: "notes", label: "Notes", icon: StickyNote },
];

const CHANGE_TONE = {
  Started: "success",
  "Dose change": "warning",
  "Quantity change": "info",
  Stopped: "danger",
  Updated: "neutral",
};

const KV = ({ label, value }) => (
  <div className="rounded-xl bg-subtle p-3">
    <div className="text-caption text-text-secondary">{label}</div>
    <div className="text-body font-semibold text-text-primary">{value || "—"}</div>
  </div>
);

export default function PatientRecord({ patient, open, onClose, initialTab = "patient" }) {
  const [tab, setTab] = useState(initialTab);
  const [pid, setPid] = useState(patient?.id);

  useEffect(() => {
    if (patient && patient.id !== pid) {
      setPid(patient.id);
      setTab(initialTab);
    }
  }, [patient, pid, initialTab]);
  if (!open || !patient) return null;

  return (
    <Modal open={open} onClose={onClose} wide title={`${patient.title} ${patient.name} · ${patient.id}`}>
      {/* Identity strip */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-subtle px-4 py-2.5 text-caption text-text-secondary">
        <span className="inline-flex items-center gap-1"><CalendarClock size={13} aria-hidden="true" /> DOB {fmtDate(patient.dob)} ({patient.age})</span>
        <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden="true" /> {patient.postcode}</span>
        {patient.allergies.length > 0 ? (
          <StatusChip tone="warning">Allergy: {patient.allergies.join(", ")}</StatusChip>
        ) : (
          <StatusChip tone="success" icon={false}>No known allergies</StatusChip>
        )}
        <StatusChip tone={patient.status === "active" ? "success" : "neutral"} icon={false}>
          {patient.status === "active" ? "Active patient" : "Inactive"}
        </StatusChip>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Patient record" className="mb-4 flex gap-1 overflow-x-auto border-b border-border-subtle">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={cx(
                "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-body font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent-ring",
                on ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text-primary"
              )}
            >
              <t.icon size={16} aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {tab === "patient" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KV label="Title" value={patient.title} />
            <KV label="Full name" value={patient.name} />
            <KV label="Patient ID" value={patient.id} />
            <KV label="Date of birth" value={`${fmtDate(patient.dob)} (${patient.age})`} />
            <KV label="Sex" value={patient.sex} />
            <KV label="Phone" value={patient.phone} />
            <KV label="Address" value={patient.address} />
            <KV label="Postcode" value={patient.postcode} />
            <KV label="Care setting" value={patient.careSetting} />
            <KV label="Allergies" value={patient.allergies.join(", ") || "None recorded"} />
          </div>
        )}

        {tab === "doctor" && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KV label="Prescriber" value={patient.doctor.name} />
            <KV label="Practice" value={patient.doctor.practice} />
            <KV label="Practice phone" value={patient.doctor.phone} />
            <KV label="Practice address" value={patient.doctor.address} />
          </div>
        )}

        {tab === "medication" && <Medication patient={patient} />}

        {tab === "dosette" && <DosetteTab patient={patient} />}

        {tab === "history" && <MedHistory patient={patient} />}

        {tab === "notes" && (
          patient.notes.length === 0
            ? <EmptyState icon={StickyNote} title="No notes" hint="Clinical and operational notes for this patient appear here." />
            : <ul className="space-y-2">
                {patient.notes.map((n) => (
                  <li key={`${n.at}-${n.staff}-${n.category}`} className="rounded-xl border border-border-subtle p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <StatusChip tone="neutral" icon={false}>{n.category}</StatusChip>
                      <span className="text-caption text-text-tertiary">{fmtDate(n.at)} · {n.staff}</span>
                    </div>
                    <p className="text-body">{n.text}</p>
                  </li>
                ))}
              </ul>
        )}
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Medication */
function Medication({ patient }) {
  const [openId, setOpenId] = useState(patient.meds[0]?.id);
  return (
    <div className="space-y-2.5">
      {patient.meds.map((m) => {
        const expanded = openId === m.id;
        return (
          <Card key={m.id} className="overflow-hidden">
            <button
              onClick={() => setOpenId(expanded ? null : m.id)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent-ring"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden="true"><Pill size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-text-primary">{m.name} {m.strength}</span>
                  <span className="text-caption text-text-tertiary">{m.form}</span>
                  <StatusChip tone={m.status === "Active" ? "success" : "neutral"} icon={false}>{m.status}</StatusChip>
                </span>
                <span className="block truncate text-caption text-text-secondary">{m.instruction}</span>
              </span>
              <span className="hidden shrink-0 text-right sm:block">
                <span className="block text-caption text-text-tertiary">Last dispensed</span>
                <span className="block text-body font-medium text-text-primary tnum">{fmtDate(m.lastDispensed)}</span>
              </span>
              <ChevronDown size={16} className={cx("shrink-0 text-text-tertiary transition-transform", expanded && "rotate-180")} aria-hidden="true" />
            </button>

            {expanded && (
              <div className="border-t border-border-subtle p-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <KV label="Dosage" value={m.instruction} />
                  <KV label="Quantity" value={`${m.quantity} per dispense`} />
                  <KV label="Form" value={m.form} />
                  <KV label="Last dispensed" value={fmtDate(m.lastDispensed)} />
                  <KV label="Previous dispense" value={fmtDate(m.previousDispensed)} />
                  <KV label="Next expected" value={m.nextExpected ? fmtDate(m.nextExpected) : "—"} />
                  <KV label="Prescribed by" value={m.prescribedBy} />
                  <KV label="Created by" value={m.createdBy} />
                  <KV label="Last updated by" value={`${m.updatedBy} · ${fmtDate(m.updatedAt)}`} />
                </div>

                <div className="mt-3 rounded-xl bg-subtle p-3">
                  <div className="text-micro uppercase text-text-tertiary">Appearance (identification)</div>
                  <div className="mt-1 text-body text-text-secondary">
                    {m.appearance.colour} · {m.appearance.shape} · imprint “{m.appearance.imprint}” — {m.appearance.description}
                  </div>
                </div>

                {m.notes && (
                  <p className="mt-3 text-caption text-text-secondary"><span className="font-medium text-text-primary">Notes: </span>{m.notes}</p>
                )}

                <div className="mt-3">
                  <div className="mb-1.5 text-micro uppercase text-text-tertiary">Audit history</div>
                  <ol className="space-y-1.5">
                    {m.changes.slice().reverse().map((c) => (
                      <li key={`${c.at}-${c.staff}-${c.type}-${c.detail}`} className="flex flex-wrap items-center gap-2 text-caption">
                        <StatusChip tone={CHANGE_TONE[c.type] || "neutral"} icon={false}>{c.type}</StatusChip>
                        <span className="text-text-secondary">{c.detail}</span>
                        <span className="text-text-tertiary tnum">· {fmtDate(c.at)} · {c.staff}{c.reason ? ` · ${c.reason}` : ""}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- History tab */
function MedHistory({ patient }) {
  const events = getMedicationHistory(patient);
  if (events.length === 0) return <EmptyState icon={History} title="No history" hint="Medication changes appear here." />;
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li key={`${e.at}-${e.staff}-${e.type}-${e.medicine}`} className="flex items-start gap-3 rounded-xl border border-border-subtle p-3">
          <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            { success: "bg-success", warning: "bg-warning", info: "bg-info", danger: "bg-danger", neutral: "bg-text-tertiary" }[CHANGE_TONE[e.type] || "neutral"])} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body font-medium text-text-primary">{e.medicine}</span>
              <span className="text-caption text-text-tertiary tnum">{fmtDate(e.at)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
              <StatusChip tone={CHANGE_TONE[e.type] || "neutral"} icon={false}>{e.type}</StatusChip>
              {e.detail}
            </div>
            <div className="text-caption text-text-tertiary">{e.staff}{e.reason ? ` · ${e.reason}` : ""}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
