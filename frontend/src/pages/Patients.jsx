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
import Button from "../components/Button";
import CareSettingBadge from "../components/CareSettingBadge";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ListToolbar from "../components/ListToolbar";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import useAuth from "../hooks/useAuth";
import useToast from "../hooks/useToast";
import api from "../services/api";
import { canManagePatients } from "../utils/access";
import { careSettingOptions, getCareSettingLabel } from "../utils/careSettings";
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

function CareSettingControl({
  canManage,
  controlId,
  isSaving,
  onChange,
  patient,
}) {
  return (
    <div className="flex min-w-44 flex-col gap-2">
      <CareSettingBadge
        label={patient.care_setting_label}
        value={patient.care_setting}
      />
      {canManage && (
        <>
          <label className="sr-only" htmlFor={controlId}>
            Update care setting for {patient.first_name} {patient.last_name}
          </label>
          <select
            id={controlId}
            className="field-control min-h-9 py-1.5 text-xs font-bold"
            disabled={isSaving}
            value={patient.care_setting}
            onChange={(event) => onChange(patient, event.target.value)}
          >
            {careSettingOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {isSaving && value === patient.care_setting
                  ? "Saving..."
                  : label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function Patients() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [careSettingFilter, setCareSettingFilter] = useState("");
  const [savingPatientId, setSavingPatientId] = useState(null);
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
  const filteredPatients = patients.filter(
    (patient) =>
      (!careSettingFilter || patient.care_setting === careSettingFilter)
      && [
        patient.first_name,
        patient.last_name,
        patient.contact_number,
        patient.notes,
        patient.date_of_birth,
        patient.care_setting,
        patient.care_setting_label,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
  );
  const canUpdateCareSetting = canManagePatients(user);

  const updateCareSetting = async (patient, careSetting) => {
    if (careSetting === patient.care_setting) {
      return;
    }

    setSavingPatientId(patient.id);

    try {
      await api.patch(`/patients/${patient.id}/`, {
        care_setting: careSetting,
      });
      toast.success(
        "Care setting updated",
        `${patient.first_name} ${patient.last_name} is now grouped under ${getCareSettingLabel(careSetting)}.`
      );
      await reload();
    } catch {
      toast.error(
        "Care setting not updated",
        "The patient grouping could not be saved. Check your role access and API connection."
      );
    } finally {
      setSavingPatientId(null);
    }
  };

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
        <ListToolbar
          shown={!isLoading && !error ? filteredPatients.length : null}
          total={!isLoading && !error ? patients.length : null}
          unit="patients shown"
          filters={
            <>
              <label className="sr-only" htmlFor="patient-care-setting-filter">
                Filter patients by care setting
              </label>
              <select
                id="patient-care-setting-filter"
                className="field-control min-w-48 font-semibold"
                value={careSettingFilter}
                onChange={(event) => setCareSettingFilter(event.target.value)}
              >
                <option value="">All care settings</option>
                {careSettingOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </>
          }
        >
          <SearchField
            id="patient-search"
            label="Search patients"
            placeholder="Search by patient name, contact, date of birth or profile notes..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </ListToolbar>

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
            <TableShell
              className="hidden md:block"
              label="Patient registry"
              minWidth="760px"
            >
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Care setting</th>
                    <th>Date of birth</th>
                    <th>Contact</th>
                    <th>General profile notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <PatientIdentity patient={patient} />
                      </td>
                      <td>
                        <CareSettingControl
                          canManage={canUpdateCareSetting}
                          controlId={`patient-care-setting-desktop-${patient.id}`}
                          isSaving={savingPatientId === patient.id}
                          patient={patient}
                          onChange={updateCareSetting}
                        />
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
                          {patient.notes || "No general profile notes recorded."}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </TableShell>

            <div className="divide-y divide-slate-100 md:hidden">
              {filteredPatients.map((patient) => (
                <article key={patient.id} className="p-4 sm:p-5">
                  <PatientIdentity patient={patient} />
                  <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Care setting
                        </dt>
                        <dd className="mt-2">
                          <CareSettingControl
                            canManage={canUpdateCareSetting}
                            controlId={`patient-care-setting-mobile-${patient.id}`}
                            isSaving={savingPatientId === patient.id}
                            patient={patient}
                            onChange={updateCareSetting}
                          />
                        </dd>
                      </div>
                    </div>
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
                          General profile notes
                        </dt>
                        <dd className="mt-1 text-sm leading-6 text-slate-600">
                          {patient.notes || "No general profile notes recorded."}
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
