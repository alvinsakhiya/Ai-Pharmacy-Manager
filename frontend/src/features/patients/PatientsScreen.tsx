import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Plus, Search, Users } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Card";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui/Table";
import { inputClass, labelClass, selectClass } from "../../components/ui/forms";
import type { Patient } from "./patientApi";
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

function PatientRow({
  patient,
  pharmacyName,
}: {
  patient: Patient;
  pharmacyName: (id: number) => string;
}) {
  return (
    <TR>
      <TD className="whitespace-nowrap font-semibold tnum text-ink">
        {patient.patient_reference}
      </TD>
      <TD className="whitespace-nowrap text-ink">
        {patient.first_name} {patient.last_name}
      </TD>
      <TD className="whitespace-nowrap tnum">
        {formatDate(patient.date_of_birth)}
      </TD>
      <TD className="whitespace-nowrap">{pharmacyName(patient.pharmacy)}</TD>
      <TD className="whitespace-nowrap">
        <StatusBadge active={patient.is_active} />
      </TD>
      <TD className="whitespace-nowrap text-right">
        <Link to={`/patients/${patient.id}`}>
          <Button variant="secondary" size="sm">
            View
          </Button>
        </Link>
      </TD>
    </TR>
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
  const patientsQuery = usePatientsQuery({
    pharmacy: selectedPharmacyId,
    search: search.trim(),
  });
  const { pharmacyName } = usePharmacyNames();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Patient records"
        title="Patients"
        subtitle="View fictional patient records for your assigned pharmacy scope."
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

      <Panel className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
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
                    event.target.value ? Number(event.target.value) : undefined,
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
      </Panel>

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

      {patientsQuery.isSuccess && patientsQuery.data.length === 0 ? (
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

      {patientsQuery.isSuccess && patientsQuery.data.length > 0 ? (
        <TableScroll>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Patient ID</TH>
                <TH>Name</TH>
                <TH>Date of birth</TH>
                <TH>Pharmacy</TH>
                <TH>Status</TH>
                <TH className="text-right">View</TH>
              </TR>
            </THead>
            <TBody>
              {patientsQuery.data.map((patient) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  pharmacyName={pharmacyName}
                />
              ))}
            </TBody>
          </Table>
        </TableScroll>
      ) : null}

      <PatientFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        patient={null}
      />
    </div>
  );
}
