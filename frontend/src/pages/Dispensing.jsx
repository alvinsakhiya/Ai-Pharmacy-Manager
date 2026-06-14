import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePoundSterling,
  FileText,
  Keyboard,
  PackageSearch,
  Pill,
  Printer,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import api from "../api/client";
import { PageHeader } from "../components/PageHeader";
import {
  Button,
  Card,
  Input,
  Modal,
  StatusChip,
  cx,
  useToast,
} from "../components/ui";
import { PATIENTS, fmtDate, searchPatients } from "../services/patientData";
import {
  FALLBACK_DIRECTIONS,
  appendDirection,
  filterDirections,
} from "../services/trustedDirections";

function warningsFor(patient, medicine) {
  const warnings = [];
  if (patient.allergies.length) {
    warnings.push({
      tone: "warning",
      text: `Recorded allergy information: ${patient.allergies.join(", ")}. Verify suitability before supply.`,
    });
  }
  if (/omeprazole|atorvastatin/i.test(medicine.name)) {
    warnings.push({
      tone: "info",
      text: "Review the patient medication record and current counselling notes before confirmation.",
    });
  }
  if (/when required/i.test(medicine.instruction)) {
    warnings.push({
      tone: "warning",
      text: "As-required item: confirm the label includes a clear frequency or maximum-use instruction.",
    });
  }
  return warnings;
}

export default function Dispensing() {
  const toast = useToast();
  const [patient, setPatient] = useState(PATIENTS[0]);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientPicker, setPatientPicker] = useState(false);
  const [itemIndex, setItemIndex] = useState(0);
  const [directions, setDirections] = useState({});
  const [acknowledged, setAcknowledged] = useState({});
  const [confirmed, setConfirmed] = useState({});
  const [directionOpen, setDirectionOpen] = useState(false);

  const item = patient.meds[itemIndex];
  const itemDirections = directions[item.id] ?? item.instruction;
  const warnings = warningsFor(patient, item);
  const warningKey = `${patient.id}-${item.id}`;
  const canConfirm =
    itemDirections.trim().length >= 3 &&
    (warnings.length === 0 || acknowledged[warningKey]);
  const results = patientQuery.trim()
    ? searchPatients(patientQuery)
    : PATIENTS.slice(0, 7);

  useEffect(() => {
    const openDirections = (event) => {
      if (event.altKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDirectionOpen(true);
      }
    };
    document.addEventListener("keydown", openDirections);
    return () => document.removeEventListener("keydown", openDirections);
  }, []);

  const choosePatient = (next) => {
    setPatient(next);
    setItemIndex(0);
    setPatientQuery("");
    setPatientPicker(false);
  };

  const confirmItem = () => {
    if (!canConfirm) return;
    setConfirmed((current) => ({ ...current, [warningKey]: true }));
    toast?.success(`${item.name} confirmed by ${patient.name}`);
    if (itemIndex < patient.meds.length - 1) setItemIndex((index) => index + 1);
  };

  return (
    <>
      <PageHeader
        title="Dispensing workspace"
        subtitle="Search, label, check and progress each item with the patient context kept visible."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print label
            </Button>
            <Button
              onClick={() => toast?.success("Prescription moved to picking")}
              disabled={patient.meds.some(
                (med) => !confirmed[`${patient.id}-${med.id}`]
              )}
            >
              <Check size={15} /> Finish prescription
            </Button>
          </div>
        }
      />

      <Card className="mb-3 overflow-visible">
        <div className="grid gap-3 p-3 lg:grid-cols-[1fr_280px_140px]">
          <div className="relative">
            <label htmlFor="dispensing-patient" className="mb-1 block text-caption text-text-secondary">
              Patient
            </label>
            <div className="flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 focus-within:ring-2 focus-within:ring-accent-ring">
              <UserRound size={16} className="text-accent" aria-hidden="true" />
              <input
                id="dispensing-patient"
                value={patientQuery}
                onChange={(event) => {
                  setPatientQuery(event.target.value);
                  setPatientPicker(true);
                }}
                onFocus={() => setPatientPicker(true)}
                placeholder={`${patient.title} ${patient.name} · ${patient.address}`}
                className="h-full min-w-0 flex-1 bg-transparent text-body focus:outline-none"
                aria-expanded={patientPicker}
                aria-controls="dispensing-patient-results"
              />
              <Search size={15} className="text-text-tertiary" aria-hidden="true" />
            </div>
            {patientPicker && (
              <ul
                id="dispensing-patient-results"
                className="absolute inset-x-0 top-[66px] z-30 max-h-72 overflow-y-auto rounded-xl border border-border-subtle bg-surface py-1 shadow-elev-3"
              >
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => choosePatient(result)}
                      className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{result.name}</span>
                        <span className="block text-caption text-text-tertiary">
                          DOB {fmtDate(result.dob)} · {result.postcode} · {result.id}
                        </span>
                      </span>
                      {result._fuzzy && <StatusChip tone="warning" icon={false}>Similar spelling</StatusChip>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ContextValue label="Prescriber" value={item.prescribedBy} />
          <ContextValue label="Items" value={`${patient.meds.length}`} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border-subtle bg-subtle/60 px-3 py-2 text-caption text-text-secondary">
          <span>DOB <strong className="text-text-primary">{fmtDate(patient.dob)}</strong></span>
          <span>Address <strong className="text-text-primary">{patient.address}</strong></span>
          <span>Allergies <strong className="text-text-primary">{patient.allergies.join(", ") || "None recorded"}</strong></span>
          <span>Patient ID <strong className="text-text-primary">{patient.id}</strong></span>
        </div>
      </Card>

      <div className="grid min-h-[620px] gap-3 xl:grid-cols-[minmax(0,1fr)_310px]">
        <Card className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Pill size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-title font-semibold">Item {itemIndex + 1}: {item.name} {item.strength}</h2>
              <p className="text-caption text-text-tertiary">{item.form} · prescription item {itemIndex + 1} of {patient.meds.length}</p>
            </div>
            {confirmed[warningKey] && <StatusChip tone="success">Confirmed</StatusChip>}
            <div className="ms-auto flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                aria-label="Previous item"
                disabled={itemIndex === 0}
                onClick={() => setItemIndex((index) => index - 1)}
              >
                <ChevronLeft size={15} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Next item"
                disabled={itemIndex === patient.meds.length - 1}
                onClick={() => setItemIndex((index) => index + 1)}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>

          <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_230px]">
            <div className="space-y-3">
              <DenseField label="Written as" value={`${item.name} ${item.strength} ${item.form}`} readOnly />
              <DenseField label="Dispense as" value={`${item.name} ${item.strength} (${item.quantity})`} readOnly />
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor="dispensing-directions" className="text-caption font-medium text-text-secondary">
                    Directions
                  </label>
                  <Button variant="secondary" size="sm" onClick={() => setDirectionOpen(true)}>
                    <Keyboard size={14} /> Trusted directions
                  </Button>
                </div>
                <textarea
                  id="dispensing-directions"
                  value={itemDirections}
                  onChange={(event) =>
                    setDirections((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                  rows={5}
                  className="w-full rounded-md border border-border-strong bg-surface p-3 text-subtitle font-medium focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring"
                />
                <p className="mt-1 text-caption text-text-tertiary">
                  Shortcut: <kbd className="rounded border border-border-strong bg-subtle px-1.5 py-0.5">Alt+D</kbd> opens the approved phrase finder.
                </p>
              </div>

              <section aria-labelledby="dispensing-warnings">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-warning-fg" aria-hidden="true" />
                  <h3 id="dispensing-warnings" className="text-subtitle font-semibold">Warnings and checks</h3>
                </div>
                <div className="space-y-2">
                  {warnings.length === 0 ? (
                    <div className="rounded-lg bg-success-bg p-3 text-body text-success-fg">
                      No additional simulated warnings for this item.
                    </div>
                  ) : warnings.map((warning) => (
                    <div
                      key={warning.text}
                      className={cx(
                        "rounded-lg border p-3 text-body",
                        warning.tone === "warning"
                          ? "border-warning/30 bg-warning-bg text-warning-fg"
                          : "border-info/30 bg-info-bg text-info-fg"
                      )}
                    >
                      {warning.text}
                    </div>
                  ))}
                </div>
                {warnings.length > 0 && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-border-strong p-3">
                    <input
                      type="checkbox"
                      checked={Boolean(acknowledged[warningKey])}
                      onChange={(event) =>
                        setAcknowledged((current) => ({
                          ...current,
                          [warningKey]: event.target.checked,
                        }))
                      }
                      className="mt-0.5 accent-accent"
                    />
                    <span className="text-body">
                      I have reviewed these warnings and the patient record. Human verification remains required.
                    </span>
                  </label>
                )}
              </section>
            </div>

            <aside className="space-y-3">
              <InfoPanel icon={PackageSearch} title="Pack and stock">
                <InfoRow label="Pack size" value={item.quantity} />
                <InfoRow label="Quantity" value={item.quantity} />
                <InfoRow label="Form" value={item.form} />
                <InfoRow label="Next expected" value={fmtDate(item.nextExpected)} />
              </InfoPanel>
              <InfoPanel icon={CirclePoundSterling} title="Cost summary">
                <InfoRow label="Item cost" value={`£${(item.quantity * 0.04).toFixed(2)}`} />
                <InfoRow label="Stock status" value="Available" />
                <InfoRow label="Allocation" value="FEFO batch" />
              </InfoPanel>
              <InfoPanel icon={ShieldCheck} title="Accuracy gate">
                <p className="text-caption text-text-secondary">
                  Confirmation records item preparation only. The separate pharmacist accuracy check is still required in the pipeline.
                </p>
              </InfoPanel>
            </aside>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-subtle/50 px-4 py-3">
            <span className="text-caption text-text-tertiary">
              {Object.keys(confirmed).filter((key) => key.startsWith(`${patient.id}-`)).length} of {patient.meds.length} items confirmed
            </span>
            <Button onClick={confirmItem} disabled={!canConfirm}>
              Confirm item <ChevronRight size={15} />
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-3">
            <FileText size={16} className="text-accent" aria-hidden="true" />
            <h2 className="text-subtitle font-semibold">Prescription items</h2>
          </div>
          <ol className="divide-y divide-border-subtle">
            {patient.meds.map((medicine, index) => {
              const key = `${patient.id}-${medicine.id}`;
              const active = index === itemIndex;
              return (
                <li key={medicine.id}>
                  <button
                    type="button"
                    onClick={() => setItemIndex(index)}
                    aria-current={active ? "step" : undefined}
                    className={cx(
                      "flex w-full items-start gap-3 px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-accent-ring",
                      active ? "bg-accent-soft" : "hover:bg-subtle"
                    )}
                  >
                    <span className={cx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold",
                      confirmed[key] ? "bg-success-bg text-success-fg" : active ? "bg-accent text-white" : "bg-subtle text-text-secondary"
                    )}>
                      {confirmed[key] ? <Check size={14} aria-label="Confirmed" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{medicine.name} {medicine.strength}</span>
                      <span className="block text-caption text-text-secondary">{medicine.instruction}</span>
                      <span className="mt-1 block text-caption text-text-tertiary">Qty {medicine.quantity} · {medicine.form}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <DirectionFinder
        open={directionOpen}
        onClose={() => setDirectionOpen(false)}
        onChoose={(direction) => {
          setDirections((current) => ({
            ...current,
            [item.id]: appendDirection(itemDirections, direction.text),
          }));
          setDirectionOpen(false);
        }}
      />

      <div id="pm-print-root" className="hidden print:block">
        <div className="pm-label">
          <div className="pm-label-head">
            <div>
              <div className="pm-label-name">{patient.title} {patient.name}</div>
              <div className="pm-label-sub">DOB {fmtDate(patient.dob)} · {patient.id}</div>
            </div>
            <div className="pm-label-cycle">AI Pharmacy Manager<br />Simulated dispensing label</div>
          </div>
          <div className="pm-label-med">
            <div className="pm-label-med-line"><strong>{item.name} {item.strength}</strong> · {item.form}</div>
            <div className="pm-label-med-dir">{itemDirections}</div>
            <div className="pm-label-med-look">Quantity: {item.quantity}</div>
          </div>
          <div className="pm-label-foot">Human accuracy check required before supply. Academic prototype; simulated data only.</div>
        </div>
      </div>
    </>
  );
}

function DirectionFinder({ open, onClose, onChoose }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(FALLBACK_DIRECTIONS);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let current = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get("/trusted-directions/", {
          params: { q: query || undefined },
        });
        if (current) setRows(response.data);
      } catch {
        if (current) setRows(filterDirections(FALLBACK_DIRECTIONS, query));
      } finally {
        if (current) setLoading(false);
      }
    }, 120);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const visible = useMemo(
    () => filterDirections(rows.length ? rows : FALLBACK_DIRECTIONS, query),
    [rows, query]
  );

  useEffect(() => setActive(0), [query]);

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && visible[active]) {
      event.preventDefault();
      onChoose(visible[active]);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Find trusted direction"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!visible[active]} onClick={() => onChoose(visible[active])}>
            Use selected direction
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-caption font-medium text-text-secondary">
            Search shortcut code or phrase
          </span>
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Examples: OD, PRN, bedtime, affected area"
            aria-controls="trusted-direction-results"
            aria-activedescendant={visible[active] ? `trusted-direction-${active}` : undefined}
          />
        </label>
        <Button variant="secondary" onClick={() => setQuery(query.trim())}>
          <Search size={15} /> Find
        </Button>
      </div>
      <div className="mb-2 flex items-center justify-between text-caption text-text-tertiary">
        <span>{visible.length} approved phrases</span>
        <span>{loading ? "Searching…" : "Use ↑ ↓ and Enter"}</span>
      </div>
      <div id="trusted-direction-results" role="listbox" className="max-h-[430px] overflow-y-auto rounded-lg border border-border-subtle">
        {visible.map((direction, index) => (
          <button
            key={direction.code}
            id={`trusted-direction-${index}`}
            role="option"
            aria-selected={index === active}
            type="button"
            onMouseEnter={() => setActive(index)}
            onDoubleClick={() => onChoose(direction)}
            onClick={() => setActive(index)}
            className={cx(
              "grid w-full grid-cols-[90px_minmax(0,1fr)_100px] gap-3 border-b border-border-subtle px-3 py-2 text-left last:border-b-0",
              index === active ? "bg-accent text-white" : "hover:bg-subtle"
            )}
          >
            <span className="font-mono font-semibold">{direction.code}</span>
            <span>{direction.text}</span>
            <span className={cx("text-caption", index === active ? "text-white/80" : "text-text-tertiary")}>
              {direction.category_display}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-caption text-text-tertiary">
        Approved phrases reduce retyping only. Staff must verify the complete label against the prescription and patient record.
      </p>
    </Modal>
  );
}

function DenseField({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption font-medium text-text-secondary">{label}</span>
      <Input {...props} />
    </label>
  );
}

function ContextValue({ label, value }) {
  return (
    <div>
      <div className="mb-1 text-caption text-text-secondary">{label}</div>
      <div className="flex h-10 items-center rounded-md bg-subtle px-3 font-medium">{value}</div>
    </div>
  );
}

function InfoPanel({ icon: Icon, title, children }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-subtle/50 p-3">
      <h3 className="mb-2 flex items-center gap-2 text-caption font-semibold uppercase text-text-secondary">
        <Icon size={14} className="text-accent" aria-hidden="true" /> {title}
      </h3>
      {children}
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-caption">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-right font-medium text-text-primary">{value || "—"}</span>
    </div>
  );
}
