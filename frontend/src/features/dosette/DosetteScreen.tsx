import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { usePermissions } from "../../auth/usePermissions";
import { Modal } from "../../components/ui/Modal";
import { PatientMedicationFormModal } from "./PatientMedicationFormModal";
import type {
  DosetteCycle,
  PatientMedicationLine,
  PickingList,
  PickingListRow,
} from "./dosetteApi";
import {
  useDiscontinuePatientMedication,
  useDosetteCyclesQuery,
  usePatientMedicationsQuery,
  usePickingListQuery,
} from "./useDosette";

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

function fallback(value: string | undefined): string {
  return value?.trim() ? value : "-";
}

function totalDaily(line: PatientMedicationLine): number {
  return (
    line.quantity_morning +
    line.quantity_lunchtime +
    line.quantity_evening +
    line.quantity_bedtime
  );
}

function statusLabel(value: boolean | string): string {
  if (typeof value === "boolean") {
    return value ? "Active" : "Inactive";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatusPill({ value }: { value: boolean | string }) {
  const active =
    value === true || value === "DRAFT" || value === "PREPARED" || value === "CHECKED";

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
      ].join(" ")}
    >
      {statusLabel(value)}
    </span>
  );
}

function QuantityCell({ value }: { value: number }) {
  return (
    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{value}</td>
  );
}

function MedicationRow({
  canManage,
  line,
  onDiscontinue,
  onEdit,
}: {
  canManage: boolean;
  line: PatientMedicationLine;
  onDiscontinue: (line: PatientMedicationLine) => void;
  onEdit: (line: PatientMedicationLine) => void;
}) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
        {line.medication_name}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {fallback([line.strength, line.form].filter(Boolean).join(" / "))}
      </td>
      <QuantityCell value={line.quantity_morning} />
      <QuantityCell value={line.quantity_lunchtime} />
      <QuantityCell value={line.quantity_evening} />
      <QuantityCell value={line.quantity_bedtime} />
      <QuantityCell value={totalDaily(line)} />
      <td className="whitespace-nowrap px-4 py-4 text-sm">
        <StatusPill value={line.is_active} />
      </td>
      {canManage ? (
        <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
          <div className="flex justify-end gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              onClick={() => onEdit(line)}
              type="button"
            >
              Edit
            </button>
            {line.is_active ? (
              <button
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                onClick={() => onDiscontinue(line)}
                type="button"
              >
                Discontinue
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function PickingListRowView({ row }: { row: PickingListRow }) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
        {row.medication_name}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {row.strength} / {row.form}
      </td>
      <QuantityCell value={row.quantity_morning} />
      <QuantityCell value={row.quantity_lunchtime} />
      <QuantityCell value={row.quantity_evening} />
      <QuantityCell value={row.quantity_bedtime} />
      <QuantityCell value={row.total_daily} />
    </tr>
  );
}

function TableHeader({
  includeStatus = false,
  includeAction = false,
}: {
  includeStatus?: boolean;
  includeAction?: boolean;
}) {
  return (
    <thead className="bg-slate-50">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          Medication
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          Strength/Form
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          Morning
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lunchtime
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          Evening
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          Bedtime
        </th>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          Total daily
        </th>
        {includeStatus ? (
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
          </th>
        ) : null}
        {includeAction ? (
          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
            Action
          </th>
        ) : null}
      </tr>
    </thead>
  );
}

function LoadingSection({ text }: { text: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
      {text}
    </section>
  );
}

function ErrorSection({
  onRetry,
  title,
}: {
  onRetry: () => void;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
      <h2 className="text-lg font-bold text-red-900">{title}</h2>
      <p className="mt-2 text-sm text-red-700">
        Please retry. Your session or permissions may need refreshing.
      </p>
      <button
        className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    </section>
  );
}

function PickingListSection({
  pickingList,
}: {
  pickingList: PickingList;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-sm font-semibold text-teal-700">
          {pickingList.patient_reference}
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-950">
          Picking list: {pickingList.cycle.reference}
        </h2>
      </div>
      {pickingList.medications.length === 0 ? (
        <p className="p-6 text-sm text-slate-600">
          No active medication lines for this cycle.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <TableHeader />
            <tbody className="divide-y divide-slate-200 bg-white">
              {pickingList.medications.map((row) => (
                <PickingListRowView key={row.medication_id} row={row} />
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td
                  className="whitespace-nowrap px-4 py-4 text-sm font-bold text-slate-950"
                  colSpan={2}
                >
                  Totals
                </td>
                <QuantityCell value={pickingList.totals.morning} />
                <QuantityCell value={pickingList.totals.lunchtime} />
                <QuantityCell value={pickingList.totals.evening} />
                <QuantityCell value={pickingList.totals.bedtime} />
                <QuantityCell value={pickingList.totals.total_daily} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export function DosetteScreen() {
  const { can } = usePermissions();
  const canManage = can("blister.manage");
  const { patientId } = useParams();
  const parsedPatientId = Number(patientId);
  const isValidPatientId = Number.isFinite(parsedPatientId);
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [editingLine, setEditingLine] = useState<PatientMedicationLine | null>(null);
  const [isMedicationModalOpen, setMedicationModalOpen] = useState(false);
  const [lineToDiscontinue, setLineToDiscontinue] =
    useState<PatientMedicationLine | null>(null);
  const medicationsQuery = usePatientMedicationsQuery(parsedPatientId);
  const cyclesQuery = useDosetteCyclesQuery(parsedPatientId);
  const pickingListQuery = usePickingListQuery(parsedPatientId, selectedCycleId);
  const discontinueMedication =
    useDiscontinuePatientMedication(parsedPatientId);

  function openCreateMedicationModal() {
    setEditingLine(null);
    setMedicationModalOpen(true);
  }

  function openEditMedicationModal(line: PatientMedicationLine) {
    setEditingLine(line);
    setMedicationModalOpen(true);
  }

  if (!isValidPatientId) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
        <h1 className="text-lg font-bold text-red-900">
          This patient was not found or is outside your access.
        </h1>
        <Link
          className="mt-4 inline-flex rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          to="/patients"
        >
          Back to patients
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          className="inline-flex text-sm font-semibold text-teal-700 transition hover:text-teal-900"
          to={`/patients/${parsedPatientId}`}
        >
          Back to patient
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
          Dosette / MDS
        </h1>
      </section>

      {medicationsQuery.isLoading ? (
        <LoadingSection text="Loading medication lines..." />
      ) : null}
      {medicationsQuery.isError ? (
        <ErrorSection
          onRetry={() => void medicationsQuery.refetch()}
          title="Could not load medication lines."
        />
      ) : null}
      {medicationsQuery.isSuccess ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-950">
              Medication lines
            </h2>
            {canManage ? (
              <button
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                onClick={openCreateMedicationModal}
                type="button"
              >
                Add medication
              </button>
            ) : null}
          </div>
          {medicationsQuery.data.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">No medication lines yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <TableHeader includeAction={canManage} includeStatus />
                <tbody className="divide-y divide-slate-200 bg-white">
                  {medicationsQuery.data.map((line) => (
                    <MedicationRow
                      canManage={canManage}
                      key={line.id}
                      line={line}
                      onDiscontinue={setLineToDiscontinue}
                      onEdit={openEditMedicationModal}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {cyclesQuery.isLoading ? <LoadingSection text="Loading cycles..." /> : null}
      {cyclesQuery.isError ? (
        <ErrorSection
          onRetry={() => void cyclesQuery.refetch()}
          title="Could not load cycles."
        />
      ) : null}
      {cyclesQuery.isSuccess && cyclesQuery.data.length === 0 ? (
        <LoadingSection text="No dosette cycles yet." />
      ) : null}
      {cyclesQuery.isSuccess && cyclesQuery.data.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-950">Cycles</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Frequency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Start - end date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {cyclesQuery.data.map((cycle: DosetteCycle) => (
                  <tr key={cycle.id}>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
                      {cycle.reference}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {statusLabel(cycle.frequency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      <StatusPill value={cycle.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        onClick={() => setSelectedCycleId(cycle.id)}
                        type="button"
                      >
                        View picking list
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedCycleId === null ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Select a cycle to view its picking list.
        </section>
      ) : null}
      {selectedCycleId !== null && pickingListQuery.isLoading ? (
        <LoadingSection text="Loading picking list..." />
      ) : null}
      {selectedCycleId !== null && pickingListQuery.isError ? (
        <ErrorSection
          onRetry={() => void pickingListQuery.refetch()}
          title="Could not load picking list."
        />
      ) : null}
      {selectedCycleId !== null && pickingListQuery.isSuccess ? (
        <PickingListSection pickingList={pickingListQuery.data} />
      ) : null}

      <PatientMedicationFormModal
        isOpen={isMedicationModalOpen}
        line={editingLine}
        onClose={() => setMedicationModalOpen(false)}
        patientId={parsedPatientId}
      />

      <Modal
        isOpen={lineToDiscontinue !== null}
        onClose={() => setLineToDiscontinue(null)}
        title="Discontinue medication line?"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-slate-700">
            This medication line will be marked inactive and removed from active
            picking lists.
          </p>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              onClick={() => setLineToDiscontinue(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={discontinueMedication.isPending}
              onClick={async () => {
                if (!lineToDiscontinue) {
                  return;
                }
                await discontinueMedication.mutateAsync(lineToDiscontinue.id);
                setLineToDiscontinue(null);
              }}
              type="button"
            >
              {discontinueMedication.isPending ? "Discontinuing..." : "Discontinue"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
