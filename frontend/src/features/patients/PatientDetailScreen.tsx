import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  ExternalLink,
  Info,
  Lock,
  MessageSquarePlus,
  Pencil,
  Pill,
  Stethoscope,
  UserRound,
  UserX,
} from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import {
  listDosetteCycles,
  listPatientMedications,
  type DosetteCycle,
} from "../dosette/dosetteApi";
import { AddPatientNoteModal } from "./AddPatientNoteModal";
import { MedicationHistoryItemsList } from "./MedicationHistoryItemsList";
import { PatientFormModal } from "./PatientFormModal";
import { PatientGpFormModal } from "./PatientGpFormModal";
import {
  useDeactivatePatient,
  usePatientNotesQuery,
  usePatientQuery,
} from "./usePatients";
import { usePharmacyNames } from "./usePharmacyNames";
import { PatientReviewsSection } from "../reviews/PatientReviewsSection";
import type { Patient } from "./patientApi";

type DetailPage = "info" | "gp" | "medication" | "notes";

const PAGES: { id: DetailPage; label: string; icon: typeof Info }[] = [
  { id: "info", label: "Patient info", icon: Info },
  { id: "gp", label: "Doctor & GP", icon: Stethoscope },
  { id: "medication", label: "Medication history", icon: Pill },
  { id: "notes", label: "Notes", icon: ClipboardList },
];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fallback(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge dot variant={active ? "success" : "neutral"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function DetailValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function PharmacistOnlyHint() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-info-border bg-info-soft p-3 text-[13px] text-info-ink">
      <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      Only a pharmacist can edit patient details, GP information, and notes.
    </p>
  );
}

export function PatientDetailScreen() {
  const { patientId } = useParams();
  const parsedPatientId = Number(patientId);

  return <PatientRecordWorkspace patientId={parsedPatientId} showBackLink />;
}

interface PatientRecordWorkspaceProps {
  patientId: number;
  showBackLink?: boolean;
  fullRecordHref?: string;
}

export function PatientRecordWorkspace({
  patientId,
  showBackLink,
  fullRecordHref,
}: PatientRecordWorkspaceProps) {
  const { can } = usePermissions();
  const canManage = can("patient.manage");
  const canViewDosette = can("blister.view");
  const isValidPatientId = Number.isFinite(patientId);
  const patientQuery = usePatientQuery(patientId);
  const notesQuery = usePatientNotesQuery(patientId);
  const deactivatePatient = useDeactivatePatient();
  const { pharmacyName } = usePharmacyNames();
  const { success, error } = useToast();
  const [activePage, setActivePage] = useState<DetailPage>("info");
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isGpModalOpen, setGpModalOpen] = useState(false);
  const [isDeactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [isAddNoteModalOpen, setAddNoteModalOpen] = useState(false);

  if (!isValidPatientId) {
    return (
      <EmptyState
        tone="danger"
        icon={<AlertTriangle className="h-6 w-6" />}
        title="This patient was not found or is outside your access."
        action={
          <Link to="/patients">
            <Button variant="danger" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to patients
            </Button>
          </Link>
        }
      />
    );
  }

  if (patientQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-4 w-32" />
        <Panel>
          <PanelBody className="space-y-4">
            <Skeleton className="h-7 w-56" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </PanelBody>
        </Panel>
      </div>
    );
  }

  if (patientQuery.isError || !patientQuery.data) {
    return (
      <EmptyState
        tone="danger"
        icon={<AlertTriangle className="h-6 w-6" />}
        title="This patient was not found or is outside your access."
        description="Please return to the patient list or retry after refreshing your session."
        action={
          <Button variant="danger" onClick={() => void patientQuery.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const patient = patientQuery.data;
  const displayName = [patient.title, patient.first_name, patient.last_name]
    .filter((part) => part && String(part).trim())
    .join(" ");

  return (
    <div className="space-y-5">
      {showBackLink ? (
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors duration-150 ease-soft hover:text-brand-hover"
          to="/patients"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to patients
        </Link>
      ) : null}

      {/* Header — always visible, actions gated by permission. */}
      <Panel>
        <PanelBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lilac-soft text-brand"
              >
                <UserRound className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                  {pharmacyName(patient.pharmacy)} · {patient.patient_reference}
                </p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-ink">
                  {displayName}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <StatusBadge active={patient.is_active} />
              {fullRecordHref ? (
                <Link to={fullRecordHref}>
                  <Button
                    variant="secondary"
                    leadingIcon={<ExternalLink className="h-4 w-4" />}
                  >
                    Open full record
                  </Button>
                </Link>
              ) : null}
              {canViewDosette ? (
                <Link to={`/patients/${patient.id}/dosette`}>
                  <Button
                    variant="secondary"
                    leadingIcon={<Pill className="h-4 w-4" />}
                  >
                    Dosette / MDS
                  </Button>
                </Link>
              ) : null}
              {canManage ? (
                <Button
                  variant="secondary"
                  leadingIcon={<Pencil className="h-4 w-4" />}
                  onClick={() => setEditModalOpen(true)}
                >
                  Edit
                </Button>
              ) : null}
              {canManage && patient.is_active ? (
                <Button
                  variant="danger"
                  leadingIcon={<UserX className="h-4 w-4" />}
                  onClick={() => setDeactivateModalOpen(true)}
                >
                  Deactivate
                </Button>
              ) : null}
            </div>
          </div>
        </PanelBody>
      </Panel>

      {/* Record: side-panel of pages + a constant-size content area. */}
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <nav
          aria-label="Patient record sections"
          className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1.5 lg:overflow-visible"
        >
          {PAGES.map((page) => {
            const Icon = page.icon;
            const isActive = activePage === page.id;
            return (
              <button
                key={page.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActivePage(page.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2.5 text-left text-[13px] font-semibold transition-all duration-150 ease-soft active:scale-[0.97] focus-ring lg:w-full",
                  isActive
                    ? "bg-brand-soft text-brand-ink"
                    : "text-ink-soft hover:bg-surface-sunken",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    isActive ? "text-brand" : "text-muted",
                  )}
                />
                {page.label}
              </button>
            );
          })}
        </nav>

        <Panel className="lg:min-h-[440px]">
          {activePage === "info" ? (
            <InfoPage patient={patient} pharmacyName={pharmacyName} />
          ) : null}
          {activePage === "gp" ? (
            <GpPage
              patient={patient}
              canManage={canManage}
              onEdit={() => setGpModalOpen(true)}
            />
          ) : null}
          {activePage === "medication" ? (
            <MedicationHistoryPage
              patientId={patient.id}
              canViewDosette={canViewDosette}
            />
          ) : null}
          {activePage === "notes" ? (
            <NotesPage
              canManage={canManage}
              notesQuery={notesQuery}
              onAddNote={() => setAddNoteModalOpen(true)}
            />
          ) : null}
        </Panel>
      </div>

      <PatientReviewsSection patientId={patientId} />

      <PatientFormModal
        isOpen={isEditModalOpen}
        onClose={() => setEditModalOpen(false)}
        patient={patient}
      />

      <PatientGpFormModal
        isOpen={isGpModalOpen}
        onClose={() => setGpModalOpen(false)}
        patientId={patient.id}
        gp={patient.gp}
      />

      <AddPatientNoteModal
        isOpen={isAddNoteModalOpen}
        onClose={() => setAddNoteModalOpen(false)}
        patientId={patient.id}
      />

      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        title="Deactivate this patient?"
        description="This patient will be marked inactive. Their existing record remains visible in your permitted scope."
      >
        <div className="flex justify-end gap-3 border-t border-line pt-5">
          <Button variant="secondary" onClick={() => setDeactivateModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deactivatePatient.isPending}
            onClick={async () => {
              try {
                await deactivatePatient.mutateAsync(patient.id);
                setDeactivateModalOpen(false);
                success("Patient deactivated");
              } catch {
                error("Could not deactivate patient");
              }
            }}
          >
            {deactivatePatient.isPending ? "Deactivating..." : "Deactivate"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function InfoPage({
  patient,
  pharmacyName,
}: {
  patient: Patient;
  pharmacyName: (id: number) => string;
}) {
  return (
    <>
      <PanelHeader title="Patient info" icon={<Info className="h-4 w-4" />} />
      <PanelBody>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailValue label="Title" value={fallback(patient.title)} />
          <DetailValue label="Patient ID" value={patient.patient_reference} />
          <DetailValue label="Pharmacy" value={pharmacyName(patient.pharmacy)} />
          <DetailValue
            label="Date of birth"
            value={formatDate(patient.date_of_birth)}
          />
          <DetailValue label="Gender" value={fallback(patient.gender)} />
          <DetailValue label="Phone" value={fallback(patient.phone)} />
          <DetailValue label="Email" value={fallback(patient.email)} />
          <DetailValue label="Postcode" value={fallback(patient.postcode)} />
          <DetailValue label="Address" value={fallback(patient.address)} />
        </dl>
        <div className="mt-6 border-t border-line pt-5">
          <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
            Summary note
          </dt>
          <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {fallback(patient.notes)}
          </dd>
        </div>
      </PanelBody>
    </>
  );
}

function GpPage({
  patient,
  canManage,
  onEdit,
}: {
  patient: Patient;
  canManage: boolean;
  onEdit: () => void;
}) {
  const gp = patient.gp ?? null;
  const hasGp =
    gp !== null &&
    Object.values(gp).some((value) => value && String(value).trim());

  return (
    <>
      <PanelHeader
        title="Doctor & GP"
        icon={<Stethoscope className="h-4 w-4" />}
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Pencil className="h-4 w-4" />}
              onClick={onEdit}
            >
              Edit GP details
            </Button>
          ) : undefined
        }
      />
      <PanelBody className="space-y-5">
        {!canManage ? <PharmacistOnlyHint /> : null}
        {hasGp ? (
          <dl className="grid gap-5 sm:grid-cols-2">
            <DetailValue label="Doctor" value={fallback(gp?.doctor_name)} />
            <DetailValue label="Practice" value={fallback(gp?.practice_name)} />
            <DetailValue
              label="Practice address"
              value={fallback(gp?.practice_address)}
            />
            <DetailValue
              label="Practice postcode"
              value={fallback(gp?.practice_postcode)}
            />
            <DetailValue
              label="Practice phone"
              value={fallback(gp?.practice_phone)}
            />
            <DetailValue
              label="Practice email"
              value={fallback(gp?.practice_email)}
            />
          </dl>
        ) : (
          <EmptyState
            icon={<Stethoscope className="h-6 w-6" />}
            title="No doctor or GP details recorded yet."
            description={
              canManage ? "Use “Edit GP details” to add them." : undefined
            }
          />
        )}
      </PanelBody>
    </>
  );
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function optionalDateTime(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "Not recorded";
}

function cycleStatusVariant(status: string): BadgeVariant {
  if (["CHECKED", "COLLECTED", "DELIVERED", "COMPLETED"].includes(status)) {
    return "success";
  }
  if (status === "PREPARED") {
    return "info";
  }
  if (status === "NEEDS_CHANGES") {
    return "warning";
  }
  if (status === "CANCELLED") {
    return "danger";
  }
  return "neutral";
}

function CycleHistoryCard({ cycle }: { cycle: DosetteCycle }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-ink">{cycle.reference}</h4>
          <p className="mt-1 text-xs font-medium text-muted tnum">
            {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)} -{" "}
            {formatLabel(cycle.frequency)}
          </p>
        </div>
        <Badge dot variant={cycleStatusVariant(cycle.status)}>
          {formatLabel(cycle.status)}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailValue label="Prepared by" value={fallback(cycle.prepared_by_email)} />
        <DetailValue label="Prepared at" value={optionalDateTime(cycle.prepared_at)} />
        <DetailValue label="Checked by" value={fallback(cycle.checked_by_email)} />
        <DetailValue label="Checked at" value={optionalDateTime(cycle.checked_at)} />
        <DetailValue
          label="Stock deducted"
          value={cycle.stock_deducted ? "Yes" : "No"}
        />
        <DetailValue label="Deducted at" value={optionalDateTime(cycle.deducted_at)} />
      </dl>
    </article>
  );
}

function MedicationHistoryPage({
  patientId,
  canViewDosette,
}: {
  patientId: number;
  canViewDosette: boolean;
}) {
  const medicationsQuery = useQuery({
    queryKey: ["patients", "medications", patientId],
    queryFn: () => listPatientMedications(patientId),
    enabled: canViewDosette,
  });
  const cyclesQuery = useQuery({
    queryKey: ["patients", "cycles", patientId],
    queryFn: () => listDosetteCycles(patientId),
    enabled: canViewDosette,
  });
  const medicationLines = medicationsQuery.data ?? [];
  const cycles = cyclesQuery.data ?? [];

  return (
    <>
      <PanelHeader
        title="Medication history"
        subtitle="Review patient-scoped medication records, Dosette activity, and dispensing events. Human review required."
        icon={<Pill className="h-4 w-4" />}
      />
      <PanelBody className="space-y-6">
        {!canViewDosette ? (
          <EmptyState
            icon={<Lock className="h-6 w-6" />}
            title="Dosette / MDS access is required"
            description="Medication history is derived from the patient's compliance-pack records."
          />
        ) : medicationsQuery.isLoading || cyclesQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : medicationsQuery.isError || cyclesQuery.isError ? (
          <EmptyState
            tone="danger"
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Could not load medication history."
          />
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-subtle px-3 py-2 text-xs font-semibold text-muted">
              <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
              Read-only history. Patient-scoped records; human review required.
            </div>

            <MedicationHistoryItemsList
              cycles={cycles}
              medicationLines={medicationLines}
            />

            <section className="space-y-3">
              <h3 className="text-[13px] font-bold text-ink">
                MDS / Dosette cycle history
              </h3>
              {cycles.length === 0 ? (
                <EmptyState
                  icon={<Pill className="h-6 w-6" />}
                  title="No pack cycles recorded."
                />
              ) : (
                <div className="grid gap-3">
                  {cycles.map((cycle) => (
                    <CycleHistoryCard cycle={cycle} key={cycle.id} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </PanelBody>
    </>
  );
}

function NotesPage({
  canManage,
  notesQuery,
  onAddNote,
}: {
  canManage: boolean;
  notesQuery: ReturnType<typeof usePatientNotesQuery>;
  onAddNote: () => void;
}) {
  return (
    <>
      <PanelHeader
        title="Note history"
        icon={<ClipboardList className="h-4 w-4" />}
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<MessageSquarePlus className="h-4 w-4" />}
              onClick={onAddNote}
            >
              Add note
            </Button>
          ) : undefined
        }
      />
      <PanelBody className="space-y-4">
        {!canManage ? <PharmacistOnlyHint /> : null}

        {notesQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}

        {notesQuery.isError ? (
          <EmptyState
            tone="danger"
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Could not load notes."
            action={
              <Button variant="danger" onClick={() => void notesQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}

        {notesQuery.isSuccess && notesQuery.data.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No notes recorded yet."
          />
        ) : null}

        {notesQuery.isSuccess && notesQuery.data.length > 0 ? (
          <ol className="space-y-3">
            {notesQuery.data.map((note) => (
              <li key={note.id}>
                <article className="rounded-xl border border-line bg-surface-subtle p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {note.body}
                  </p>
                  <p className="mt-3 text-xs font-medium text-muted tnum">
                    {note.author_email} - {formatDateTime(note.created_at)}
                  </p>
                </article>
              </li>
            ))}
          </ol>
        ) : null}
      </PanelBody>
    </>
  );
}
