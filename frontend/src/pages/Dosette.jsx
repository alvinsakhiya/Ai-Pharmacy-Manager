import { useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Grid2X2,
  PauseCircle,
  Pill,
  RotateCw,
  UserRound,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import DoseSchedule, { DoseSlot } from "../components/DoseSchedule";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ClinicalMetric from "../components/ClinicalMetric";
import ListToolbar from "../components/ListToolbar";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import dosePeriods from "../utils/dosePeriods";

function MedicationCell({ record }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700">
        <Pill size={19} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{record.medication_name}</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
          {record.medication_strength} / {record.medication_form}
        </p>
      </div>
    </div>
  );
}

function Dosette() {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    data: records,
    error,
    isLoading,
    reload,
  } = useApiResource(
    "/dosette-records/",
    "Dosette schedules could not be retrieved. Check the API connection and try again."
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRecords = records.filter((record) =>
    [
      record.patient_name,
      record.medication_name,
      record.medication_strength,
      record.medication_form,
      record.instructions,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery))
  );
  const activeCount = records.filter((record) => record.is_active).length;

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Medication scheduling"
        title="Dosette management"
        description="Review patient-specific medicines and dose timings across the daily dosette schedule."
        icon={Grid2X2}
        actions={
          <Button icon={RotateCw} variant="secondary" onClick={reload}>
            Refresh schedules
          </Button>
        }
      />

      {!isLoading && !error && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:flex">
          <ClinicalMetric
            description="Included in weekly demand"
            icon={CheckCircle2}
            label="Active schedules"
            tone="ready"
            value={activeCount}
          />
          <ClinicalMetric
            description="Excluded from current picking"
            icon={PauseCircle}
            label="Inactive schedules"
            tone="neutral"
            value={records.length - activeCount}
          />
        </div>
      )}

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!isLoading && !error ? filteredRecords.length : null}
          total={!isLoading && !error ? records.length : null}
          unit="schedules shown"
        >
          <SearchField
            id="dosette-search"
            label="Search dosette schedules"
            placeholder="Search patient, medication, strength or instructions..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </ListToolbar>

        {isLoading ? (
          <LoadingState label="Loading dosette schedules..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={normalizedQuery ? "No matching schedules" : "No dosette schedules"}
            message={
              normalizedQuery
                ? "Try a different patient, medicine, strength or instruction."
                : "Patient medication schedules will appear here when available."
            }
          />
        ) : (
          <>
            <TableShell
              className="hidden lg:block"
              label="Patient dosette medication schedules"
              minWidth="1260px"
            >
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Medication</th>
                    {dosePeriods.map((period) => (
                      <th key={period.key}>
                        {period.label} ({period.code})
                      </th>
                    ))}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <UserRound className="text-blue-600" size={18} />
                          <span className="font-bold text-slate-900">
                            {record.patient_name}
                          </span>
                        </div>
                      </td>
                      <td className="min-w-60">
                        <MedicationCell record={record} />
                        {record.instructions && (
                          <p className="mt-2 line-clamp-1 text-xs text-slate-400">
                            {record.instructions}
                          </p>
                        )}
                      </td>
                      {dosePeriods.map((period) => (
                        <td key={period.key}>
                          <DoseSlot
                            compact
                            code={period.code}
                            icon={period.icon}
                            label={period.label}
                            style={period.style}
                            value={record[`${period.key}_dose`]}
                          />
                        </td>
                      ))}
                      <td>
                        <Badge dot tone={record.is_active ? "success" : "slate"}>
                          {record.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </TableShell>

            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:hidden">
              {filteredRecords.map((record) => (
                <article
                  key={record.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-bold text-slate-950">
                        <UserRound className="shrink-0 text-blue-600" size={17} />
                        <span className="truncate">{record.patient_name}</span>
                      </p>
                    </div>
                    <Badge dot tone={record.is_active ? "success" : "slate"}>
                      {record.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                    <MedicationCell record={record} />
                  </div>

                  <div className="mt-4">
                    <DoseSchedule
                      doses={{
                        morning: record.morning_dose,
                        afternoon: record.afternoon_dose,
                        evening: record.evening_dose,
                        bedtime: record.bedtime_dose,
                      }}
                    />
                  </div>

                  {record.instructions && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs leading-5 text-slate-500">
                      <FileText className="mt-0.5 shrink-0" size={15} />
                      {record.instructions}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default Dosette;
