import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { usePermissions } from "../../auth/usePermissions";
import { Modal } from "../../components/ui/Modal";
import { PatientFormModal } from "./PatientFormModal";
import { useDeactivatePatient, usePatientQuery } from "./usePatients";
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

function fallback(value: string): string {
  return value.trim() ? value : "-";
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
      ].join(" ")}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

export function PatientDetailScreen() {
  const { can } = usePermissions();
  const canManage = can("patient.manage");
  const { patientId } = useParams();
  const parsedPatientId = Number(patientId);
  const isValidPatientId = Number.isFinite(parsedPatientId);
  const patientQuery = usePatientQuery(parsedPatientId);
  const deactivatePatient = useDeactivatePatient();
  const { pharmacyName } = usePharmacyNames();
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isDeactivateModalOpen, setDeactivateModalOpen] = useState(false);

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

  if (patientQuery.isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
        Loading patient...
      </section>
    );
  }

  if (patientQuery.isError || !patientQuery.data) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
        <h1 className="text-lg font-bold text-red-900">
          This patient was not found or is outside your access.
        </h1>
        <p className="mt-2 text-sm text-red-700">
          Please return to the patient list or retry after refreshing your
          session.
        </p>
        <button
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          onClick={() => void patientQuery.refetch()}
          type="button"
        >
          Retry
        </button>
      </section>
    );
  }

  const patient = patientQuery.data;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex text-sm font-semibold text-teal-700 transition hover:text-teal-900"
        to="/patients"
      >
        Back to patients
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              {pharmacyName(patient.pharmacy)}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {patient.first_name} {patient.last_name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill active={patient.is_active} />
            {canManage ? (
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                onClick={() => setEditModalOpen(true)}
                type="button"
              >
                Edit
              </button>
            ) : null}
            {canManage && patient.is_active ? (
              <button
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                onClick={() => setDeactivateModalOpen(true)}
                type="button"
              >
                Deactivate
              </button>
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailValue label="Reference" value={patient.patient_reference} />
          <DetailValue
            label="Pharmacy"
            value={pharmacyName(patient.pharmacy)}
          />
          <DetailValue
            label="Date of birth"
            value={formatDate(patient.date_of_birth)}
          />
          <DetailValue label="Address" value={fallback(patient.address)} />
          <DetailValue label="Postcode" value={fallback(patient.postcode)} />
          <DetailValue label="Phone" value={fallback(patient.phone)} />
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Patient notes</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {fallback(patient.notes)}
        </p>
      </section>

      <PatientFormModal
        isOpen={isEditModalOpen}
        onClose={() => setEditModalOpen(false)}
        patient={patient}
      />

      <Modal
        isOpen={isDeactivateModalOpen}
        onClose={() => setDeactivateModalOpen(false)}
        title="Deactivate this patient?"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-slate-700">
            This patient will be marked inactive. Their existing record remains
            visible in your permitted scope.
          </p>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              onClick={() => setDeactivateModalOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deactivatePatient.isPending}
              onClick={async () => {
                await deactivatePatient.mutateAsync(patient.id);
                setDeactivateModalOpen(false);
              }}
              type="button"
            >
              {deactivatePatient.isPending ? "Deactivating..." : "Deactivate"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
