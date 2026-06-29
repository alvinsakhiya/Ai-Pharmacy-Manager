import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Eye,
  Filter,
  MapPin,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { inputClass, labelClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import {
  collectionMethodLabel,
  normaliseCollectionMethod,
  type Patient,
} from "./patientApi";
import { PatientRecordWorkspace } from "./PatientDetailScreen";
import { PatientFormModal } from "./PatientFormModal";
import { usePatientsQuery } from "./usePatients";
import { usePharmacyNames } from "./usePharmacyNames";

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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge dot variant={active ? "success" : "neutral"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function CollectionMethodBadge({ patient }: { patient: Patient }) {
  const method = normaliseCollectionMethod(patient.collection_method);
  return (
    <Badge dot variant={method === "DELIVERY" ? "info" : "brand"}>
      {collectionMethodLabel(method)}
    </Badge>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-soft">
      <p className="text-xs font-semibold text-muted">
        {label}
      </p>
      <p className="tnum mt-1.5 text-2xl font-extrabold tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted">{helper}</p>
    </div>
  );
}

function DirectoryMeta({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-subtle text-brand"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="font-semibold text-ink-soft">{label}</span>{" "}
        <span className="tnum text-muted">{value}</span>
      </span>
    </div>
  );
}

function PatientDirectoryCard({
  patient,
  pharmacyName,
  onView,
}: {
  patient: Patient;
  pharmacyName: (id: number) => string;
  onView: (patientId: number) => void;
}) {
  return (
    <article
      role="listitem"
      className={cn(
        "grid gap-4 rounded-2xl border border-line bg-surface p-4 shadow-elev-1 transition-all duration-150 ease-soft",
        "hover:border-line-strong hover:shadow-elev-2",
        "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto]",
      )}
    >
      <div className="flex min-w-0 gap-3.5">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lilac-soft text-brand"
        >
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="tnum text-xs font-bold text-brand">
              {patient.patient_reference}
            </p>
            <StatusBadge active={patient.is_active} />
            <CollectionMethodBadge patient={patient} />
          </div>
          <h3 className="mt-1 truncate text-base font-extrabold tracking-[-0.01em] text-ink">
            {patient.first_name} {patient.last_name}
          </h3>
          <p className="mt-1 truncate text-sm text-muted">
            {patient.phone || patient.postcode || "Contact details not recorded"}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <DirectoryMeta
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label="DOB"
          value={formatDate(patient.date_of_birth)}
        />
        <DirectoryMeta
          icon={<MapPin className="h-3.5 w-3.5" />}
          label="Pharmacy"
          value={pharmacyName(patient.pharmacy)}
        />
      </div>

      <div className="flex items-center justify-start lg:justify-end">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Eye className="h-4 w-4" />}
          trailingIcon={<ArrowRight className="h-4 w-4" />}
          onClick={() => onView(patient.id)}
        >
          View record
        </Button>
      </div>
    </article>
  );
}

export function PatientsScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canManage = can("patient.manage");
  const pharmacies = user?.pharmacies ?? [];
  const [search, setSearch] = useState("");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<
    number | undefined
  >(undefined);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [workspacePatientId, setWorkspacePatientId] = useState<number | null>(
    null,
  );
  const patientsQuery = usePatientsQuery({
    pharmacy: selectedPharmacyId,
    search: search.trim(),
  });
  const { pharmacyName } = usePharmacyNames();
  const patients = patientsQuery.data ?? [];
  const activePatients = patients.filter((patient) => patient.is_active).length;
  const inactivePatients = patients.length - activePatients;
  const deliveryPatients = patients.filter(
    (patient) => normaliseCollectionMethod(patient.collection_method) === "DELIVERY",
  ).length;
  const selectedScopeLabel =
    selectedPharmacyId === undefined
      ? pharmacies.length > 1
        ? "All assigned pharmacies"
        : pharmacies[0]?.name ?? "Assigned pharmacy"
      : pharmacyName(selectedPharmacyId);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Patient records"
        title="Patients"
        subtitle="Find patient records in your permitted pharmacy scope and open the full workspace when more detail is needed."
        actions={
          canManage ? (
            <Button
              variant="primary"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create patient
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Visible records"
          value={patientsQuery.isSuccess ? String(patients.length) : "-"}
          helper={selectedScopeLabel}
        />
        <SummaryCard
          label="Active records"
          value={patientsQuery.isSuccess ? String(activePatients) : "-"}
          helper="Available in current filters"
        />
        <SummaryCard
          label="Delivery"
          value={patientsQuery.isSuccess ? String(deliveryPatients) : "-"}
          helper="Patients marked for delivery"
        />
        <SummaryCard
          label="Inactive records"
          value={patientsQuery.isSuccess ? String(inactivePatients) : "-"}
          helper="Retained for record review"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Search and scope"
          subtitle="Filter the list without leaving your current page."
          icon={<Filter className="h-4 w-4" />}
        />
        <PanelBody>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <label className={labelClass}>
              Search
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  className={`${inputClass} pl-9`}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by Patient ID or exact last name"
                  type="search"
                  value={search}
                />
              </div>
            </label>

            {pharmacies.length > 1 ? (
              <label className={labelClass}>
                Pharmacy
                <select
                  className={selectClass}
                  onChange={(event) =>
                    setSelectedPharmacyId(
                      event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    )
                  }
                  value={selectedPharmacyId ?? ""}
                >
                  <option value="">All pharmacies</option>
                  {pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </PanelBody>
      </Panel>

      {patientsQuery.isSuccess && patients.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Patient directory"
            subtitle={`${patients.length} ${patients.length === 1 ? "record" : "records"} shown`}
            icon={<Users className="h-4 w-4" />}
            actions={
              <Badge variant="neutral">{selectedScopeLabel}</Badge>
            }
          />
          <PanelBody>
            <div
              aria-label="Patient directory"
              className="grid gap-3"
              role="list"
            >
              {patients.map((patient) => (
                <PatientDirectoryCard
                  key={patient.id}
                  patient={patient}
                  pharmacyName={pharmacyName}
                  onView={setWorkspacePatientId}
                />
              ))}
            </div>
          </PanelBody>
        </Panel>
      ) : null}

      {patientsQuery.isLoading ? (
        <Panel className="p-4 sm:p-5">
          <SkeletonRows rows={5} />
        </Panel>
      ) : null}

      {patientsQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Could not load patients."
          description="Please retry. Your session or permissions may need refreshing."
          action={
            <Button
              variant="danger"
              onClick={() => void patientsQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {patientsQuery.isSuccess && patients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No patients yet."
          description="Patient records in your scope will appear here once added."
          action={
            canManage ? (
              <Button
                variant="primary"
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create patient
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <PatientFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        patient={null}
      />

      <Modal
        isOpen={workspacePatientId !== null}
        onClose={() => setWorkspacePatientId(null)}
        title="Patient record workspace"
        description="Review this patient record without leaving the Patients list."
        size="xl"
      >
        {workspacePatientId !== null ? (
          <PatientRecordWorkspace
            patientId={workspacePatientId}
            fullRecordHref={`/patients/${workspacePatientId}`}
          />
        ) : null}
      </Modal>
    </div>
  );
}
