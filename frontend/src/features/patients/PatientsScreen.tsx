import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import type { Patient } from "./patientApi";
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

function PatientRow({
  patient,
  pharmacyName,
}: {
  patient: Patient;
  pharmacyName: (id: number) => string;
}) {
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-950">
        {patient.patient_reference}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {patient.first_name} {patient.last_name}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {formatDate(patient.date_of_birth)}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
        {pharmacyName(patient.pharmacy)}
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-sm">
        <StatusPill active={patient.is_active} />
      </td>
      <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
        <Link
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          to={`/patients/${patient.id}`}
        >
          View
        </Link>
      </td>
    </tr>
  );
}

export function PatientsScreen() {
  const { user } = useAuth();
  const pharmacies = user?.pharmacies ?? [];
  const [search, setSearch] = useState("");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<
    number | undefined
  >(undefined);
  const patientsQuery = usePatientsQuery({
    pharmacy: selectedPharmacyId,
    search: search.trim(),
  });
  const { pharmacyName } = usePharmacyNames();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-teal-700">Patient records</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Patients
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            View fictional patient records for your assigned pharmacy scope.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Search
            <input
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by reference or exact last name"
              type="search"
              value={search}
            />
          </label>

          {pharmacies.length > 1 ? (
            <label className="text-sm font-medium text-slate-700">
              Pharmacy
              <select
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
      </section>

      {patientsQuery.isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading patients...
        </section>
      ) : null}

      {patientsQuery.isError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-red-900">
            Could not load patients.
          </h2>
          <p className="mt-2 text-sm text-red-700">
            Please retry. Your session or permissions may need refreshing.
          </p>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void patientsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </section>
      ) : null}

      {patientsQuery.isSuccess && patientsQuery.data.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No patients yet.
        </section>
      ) : null}

      {patientsQuery.isSuccess && patientsQuery.data.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date of birth
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pharmacy
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    View
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {patientsQuery.data.map((patient) => (
                  <PatientRow
                    key={patient.id}
                    patient={patient}
                    pharmacyName={pharmacyName}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
