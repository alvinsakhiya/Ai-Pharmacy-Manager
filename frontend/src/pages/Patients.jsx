import { useState } from "react";
import {
  CalendarDays,
  FileText,
  Phone,
  RotateCw,
  UserRound,
  Users,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import useApiResource from "../hooks/useApiResource";
import { formatDate, getInitials } from "../utils/helpers";

function PatientIdentity({ patient }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-100/80 to-violet-100/80 text-xs font-black text-blue-700 ring-1 ring-blue-200/70">
        {getInitials(patient.first_name, patient.last_name)}
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">
          {patient.first_name} {patient.last_name}
        </p>
        <p className="mt-0.5 text-xs font-medium text-slate-400">
          Patient ID #{String(patient.id).padStart(4, "0")}
        </p>
      </div>
    </div>
  );
}

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
      patient.date_of_birth,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  );

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Patient care"
        title="Patient management"
        description="Search patient records and review the profiles supporting dosette medication workflows."
        icon={Users}
        actions={
          <Button icon={RotateCw} variant="secondary" onClick={reload}>
            Refresh records
          </Button>
        }
      />

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 p-4 sm:p-5 lg:flex-row lg:items-center">
          <SearchField
            id="patient-search"
            label="Search patients"
            placeholder="Search by patient name, contact, date of birth or notes..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
          {!isLoading && !error && (
            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <Badge dot tone="teal">
                {filteredPatients.length} shown
              </Badge>
              <span className="text-xs font-semibold text-slate-400">
                {patients.length} total
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <LoadingState label="Loading patient registry..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={normalizedQuery ? "No matching patients" : "No patient records"}
            message={
              normalizedQuery
                ? "Try a different name, contact number, date of birth or note."
                : "Patient records will appear here when they are available."
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Date of birth</th>
                    <th>Contact</th>
                    <th>Clinical notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <PatientIdentity patient={patient} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                          <CalendarDays className="text-slate-400" size={16} />
                          {formatDate(patient.date_of_birth)}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="text-slate-400" size={16} />
                          {patient.contact_number || "Not provided"}
                        </div>
                      </td>
                      <td className="max-w-md">
                        <p className="line-clamp-2 text-sm leading-6 text-slate-500">
                          {patient.notes || "No clinical notes recorded."}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredPatients.map((patient) => (
                <article key={patient.id} className="p-4 sm:p-5">
                  <PatientIdentity patient={patient} />
                  <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <CalendarDays className="mt-0.5 text-slate-400" size={17} />
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Date of birth
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-700">
                          {formatDate(patient.date_of_birth)}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 text-slate-400" size={17} />
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Contact
                        </dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-700">
                          {patient.contact_number || "Not provided"}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 text-slate-400" size={17} />
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Notes
                        </dt>
                        <dd className="mt-1 text-sm leading-6 text-slate-600">
                          {patient.notes || "No clinical notes recorded."}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default Patients;
