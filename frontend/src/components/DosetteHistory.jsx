import {
  CalendarClock,
  CheckCircle2,
  History,
  PauseCircle,
  Pencil,
  PlusCircle,
  RotateCw,
  Trash2,
} from "lucide-react";
import Badge from "./Badge";
import Button from "./Button";
import DoseSchedule from "./DoseSchedule";
import { EmptyState, ErrorState, LoadingState } from "./PageState";
import { Panel, PanelHeader } from "./Panel";
import TableShell from "./TableShell";
import { formatDate } from "../utils/helpers";

const changeConfig = {
  CREATED: { icon: PlusCircle, tone: "success" },
  UPDATED: { icon: Pencil, tone: "blue" },
  ACTIVATED: { icon: CheckCircle2, tone: "success" },
  DEACTIVATED: { icon: PauseCircle, tone: "warning" },
  DELETED: { icon: Trash2, tone: "danger" },
};

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFieldName(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ChangeBadge({ change }) {
  const config = changeConfig[change.change_type] || changeConfig.UPDATED;

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {change.change_type_label}
    </Badge>
  );
}

function ChangedFields({ fields }) {
  if (!fields?.length) {
    return <span className="text-sm text-slate-400">No fields listed</span>;
  }

  return (
    <div className="flex max-w-sm flex-wrap gap-1.5">
      {fields.map((field) => (
        <span
          key={field}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600"
        >
          {formatFieldName(field)}
        </span>
      ))}
    </div>
  );
}

function CycleSummary({ change }) {
  return (
    <div className="text-sm leading-6 text-slate-600">
      <p className="font-bold text-slate-800">
        {change.cycle_length_weeks} week cycle
      </p>
      <p>
        Start:{" "}
        {change.cycle_start_date
          ? formatDate(change.cycle_start_date)
          : "Not recorded"}
      </p>
      <p>
        Review:{" "}
        {change.review_date ? formatDate(change.review_date) : "Not scheduled"}
      </p>
    </div>
  );
}

function DosetteHistory({
  changes,
  error,
  isLoading,
  isReloading,
  onReload,
  total,
}) {
  return (
    <Panel className="mt-6 overflow-hidden">
      <PanelHeader
        eyebrow="Governed medication workflow"
        icon={History}
        title="Latest schedule change history"
        description="Review immutable dose, lifecycle, cycle and review snapshots. Instruction text is intentionally not duplicated here."
        action={
          <Button
            icon={RotateCw}
            loading={isReloading}
            variant="secondary"
            onClick={onReload}
          >
            Refresh history
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading dosette change history..." />
      ) : error ? (
        <ErrorState message={error} onRetry={onReload} />
      ) : changes.length === 0 ? (
        <EmptyState
          icon={History}
          title="No schedule history yet"
          message="New dosette schedule creates and updates will appear here automatically."
        />
      ) : (
        <>
          <div className="border-b border-white/75 px-5 py-3 text-xs font-semibold text-slate-500 sm:px-6">
            Showing {changes.length} of {total} recorded changes
          </div>

          <TableShell
            className="hidden xl:block"
            label="Immutable dosette medication change history"
            minWidth="1440px"
          >
            <thead>
              <tr>
                <th>Recorded</th>
                <th>Patient / medication</th>
                <th>Change</th>
                <th>Changed fields</th>
                <th>Dose snapshot</th>
                <th>Cycle / review</th>
                <th>Status / actor</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.id}>
                  <td className="whitespace-nowrap text-sm font-semibold text-slate-600">
                    {formatTimestamp(change.timestamp)}
                  </td>
                  <td>
                    <p className="font-bold text-slate-950">
                      {change.patient_name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {change.medication_name}
                    </p>
                  </td>
                  <td>
                    <ChangeBadge change={change} />
                  </td>
                  <td>
                    <ChangedFields fields={change.changed_fields} />
                  </td>
                  <td className="min-w-80">
                    <DoseSchedule
                      compact
                      doses={{
                        morning: change.morning_dose,
                        afternoon: change.afternoon_dose,
                        evening: change.evening_dose,
                        bedtime: change.bedtime_dose,
                      }}
                    />
                  </td>
                  <td>
                    <CycleSummary change={change} />
                  </td>
                  <td>
                    <Badge tone={change.is_active ? "success" : "slate"}>
                      {change.is_active ? "Active snapshot" : "Inactive snapshot"}
                    </Badge>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      {change.actor_display}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>

          <div className="divide-y divide-slate-100 xl:hidden">
            {changes.map((change) => (
              <article key={change.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">
                      {change.patient_name}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {change.medication_name}
                    </p>
                  </div>
                  <ChangeBadge change={change} />
                </div>

                <div className="mt-4">
                  <DoseSchedule
                    doses={{
                      morning: change.morning_dose,
                      afternoon: change.afternoon_dose,
                      evening: change.evening_dose,
                      bedtime: change.bedtime_dose,
                    }}
                  />
                </div>

                <div className="mt-4 grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Cycle snapshot
                    </p>
                    <CycleSummary change={change} />
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Changed fields
                    </p>
                    <ChangedFields fields={change.changed_fields} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock aria-hidden="true" size={14} />
                    {formatTimestamp(change.timestamp)}
                  </span>
                  <span>{change.actor_display}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

export default DosetteHistory;
