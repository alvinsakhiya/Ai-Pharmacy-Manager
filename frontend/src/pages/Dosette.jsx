import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Grid2X2,
  PauseCircle,
  PencilLine,
  Pill,
  RotateCw,
  UserRound,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import CareSettingBadge from "../components/CareSettingBadge";
import Button from "../components/Button";
import DoseSchedule, { DoseSlot } from "../components/DoseSchedule";
import DosetteCycleEditor from "../components/DosetteCycleEditor";
import DosetteHistory from "../components/DosetteHistory";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ClinicalMetric from "../components/ClinicalMetric";
import ListToolbar from "../components/ListToolbar";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import useAuth from "../hooks/useAuth";
import { canManageDosette } from "../utils/access";
import { careSettingOptions } from "../utils/careSettings";
import dosePeriods from "../utils/dosePeriods";
import { formatDate } from "../utils/helpers";

function getReviewStatus(reviewDate) {
  if (!reviewDate) {
    return {
      label: "Review not scheduled",
      tone: "slate",
      needsAttention: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const review = new Date(`${reviewDate}T00:00:00`);
  const days = Math.round((review - today) / 86400000);

  if (days < 0) {
    return {
      label: `Review overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`,
      tone: "danger",
      needsAttention: true,
    };
  }

  if (days === 0) {
    return {
      label: "Review due today",
      tone: "warning",
      needsAttention: true,
    };
  }

  if (days <= 30) {
    return {
      label: `Review in ${days} day${days === 1 ? "" : "s"}`,
      tone: "warning",
      needsAttention: true,
    };
  }

  return {
    label: `Review ${formatDate(reviewDate)}`,
    tone: "success",
    needsAttention: false,
  };
}

function CycleCell({ record }) {
  const reviewStatus = getReviewStatus(record.review_date);

  return (
    <div className="min-w-48">
      <p className="font-bold text-slate-900">
        {record.cycle_length_weeks} week cycle
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        Start:{" "}
        {record.cycle_start_date
          ? formatDate(record.cycle_start_date)
          : "Not recorded"}
      </p>
      <Badge className="mt-2" icon={CalendarClock} tone={reviewStatus.tone}>
        {reviewStatus.label}
      </Badge>
    </div>
  );
}

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
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [careSettingFilter, setCareSettingFilter] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);
  const {
    data: records,
    error,
    isLoading,
    isReloading,
    reload,
  } = useApiResource(
    "/dosette-records/",
    "Dosette schedules could not be retrieved. Check the API connection and try again."
  );
  const {
    data: historyData,
    error: historyError,
    isLoading: historyLoading,
    isReloading: historyReloading,
    reload: reloadHistory,
  } = useApiResource(
    "/dosette-changes/?page_size=50",
    "Dosette schedule history could not be retrieved.",
    { count: 0, next: null, previous: null, results: [] }
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRecords = records.filter(
    (record) =>
      (
        !careSettingFilter
        || record.patient_care_setting === careSettingFilter
      )
      && [
        record.patient_name,
        record.medication_name,
        record.medication_strength,
        record.medication_form,
        record.instructions,
        record.patient_care_setting,
        record.patient_care_setting_label,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
  );
  const activeCount = records.filter((record) => record.is_active).length;
  const reviewAttentionCount = records.filter(
    (record) => getReviewStatus(record.review_date).needsAttention
  ).length;
  const historyChanges = historyData?.results || [];
  const canUpdateCycle = canManageDosette(user);

  const reloadAll = async () => {
    await Promise.allSettled([reload(), reloadHistory()]);
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Medication scheduling"
        title="Dosette management"
        description="Review patient-specific medicines and dose timings across the daily dosette schedule."
        icon={Grid2X2}
        actions={
          <Button
            icon={RotateCw}
            loading={isReloading || historyReloading}
            variant="secondary"
            onClick={reloadAll}
          >
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
          <ClinicalMetric
            description="Due today, overdue or within 30 days"
            icon={CalendarClock}
            label="Review attention"
            tone={reviewAttentionCount > 0 ? "attention" : "ready"}
            value={reviewAttentionCount}
          />
        </div>
      )}

      {editingRecord && (
        <DosetteCycleEditor
          key={editingRecord.id}
          record={editingRecord}
          onCancel={() => setEditingRecord(null)}
          onSaved={reloadAll}
        />
      )}

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!isLoading && !error ? filteredRecords.length : null}
          total={!isLoading && !error ? records.length : null}
          unit="schedules shown"
          filters={
            <>
              <label className="sr-only" htmlFor="dosette-care-setting-filter">
                Filter dosette schedules by care setting
              </label>
              <select
                id="dosette-care-setting-filter"
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
            id="dosette-search"
            label="Search dosette schedules"
            placeholder="Search patient, medication, care setting or instructions..."
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
              minWidth="1680px"
            >
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Care setting</th>
                    <th>Medication</th>
                    {dosePeriods.map((period) => (
                      <th key={period.key}>
                        {period.label} ({period.code})
                      </th>
                    ))}
                    <th>Cycle / review</th>
                    <th>Status</th>
                    {canUpdateCycle && <th>Action</th>}
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
                      <td>
                        <CareSettingBadge
                          label={record.patient_care_setting_label}
                          value={record.patient_care_setting}
                        />
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
                        <CycleCell record={record} />
                      </td>
                      <td>
                        <Badge dot tone={record.is_active ? "success" : "slate"}>
                          {record.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      {canUpdateCycle && (
                        <td>
                          <Button
                            icon={PencilLine}
                            variant="secondary"
                            onClick={() => setEditingRecord(record)}
                          >
                            Edit cycle
                          </Button>
                        </td>
                      )}
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
                      <div className="mt-2">
                        <CareSettingBadge
                          label={record.patient_care_setting_label}
                          value={record.patient_care_setting}
                        />
                      </div>
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

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <CycleCell record={record} />
                  </div>

                  {canUpdateCycle && (
                    <Button
                      className="mt-4 w-full"
                      icon={PencilLine}
                      variant="secondary"
                      onClick={() => setEditingRecord(record)}
                    >
                      Edit cycle details
                    </Button>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </Panel>

      <DosetteHistory
        changes={historyChanges}
        error={historyError}
        isLoading={historyLoading}
        isReloading={historyReloading}
        onReload={reloadHistory}
        total={historyData?.count || 0}
      />
    </MainLayout>
  );
}

export default Dosette;
