import { Link, useParams } from "react-router-dom";

import { usePatientQuery } from "./usePatients";
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
  const { patientId } = useParams();
  const parsedPatientId = Number(patientId);
  const isValidPatientId = Number.isFinite(parsedPatientId);
  const patientQuery = usePatientQuery(parsedPatientId);
  const { pharmacyName } = usePharmacyNames();

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
          <StatusPill active={patient.is_active} />
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
    </div>
  );
}
