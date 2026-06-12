import { useState } from "react";
import MainLayout from "../layouts/MainLayout";
import { Search, UserPlus } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import useApiResource from "../hooks/useApiResource";

function Patients() {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    data: patients,
    error,
    isLoading,
    reload,
  } = useApiResource(
    "/patients/",
    "Patient records could not be retrieved. Check the API connection and try again."
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredPatients = patients.filter((patient) =>
    [
      patient.first_name,
      patient.last_name,
      patient.contact_number,
      patient.notes,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  );

  return (
    <MainLayout>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Patients</h1>
          <p className="text-slate-500 mt-2">
            Manage patient records and dosette profiles.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-white transition hover:bg-slate-800"
        >
          <UserPlus size={20} />
          Add Patient
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 p-5 sm:p-6">
          <Search className="text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search patients..."
            aria-label="Search patients"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full text-slate-700 outline-none placeholder:text-slate-400"
          />
          {!isLoading && !error && (
            <span
              className="whitespace-nowrap text-xs font-medium text-slate-400"
              aria-live="polite"
            >
              {filteredPatients.length} result(s)
            </span>
          )}
        </div>

        {isLoading ? (
          <LoadingState label="Loading patient records..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            title={normalizedQuery ? "No matching patients" : "No patient records"}
            message={
              normalizedQuery
                ? "Try a different name, contact number or note."
                : "Patient records will appear here when they are available."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th className="px-6 py-4">Patient</th>
                  <th className="px-6 py-4">Date of Birth</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Notes</th>
                </tr>
              </thead>

              <tbody>
                {filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {patient.first_name} {patient.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {patient.date_of_birth}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {patient.contact_number || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {patient.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default Patients;
