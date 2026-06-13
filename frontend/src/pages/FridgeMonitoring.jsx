import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Refrigerator,
  RotateCw,
  ShieldAlert,
  Snowflake,
  ThermometerSnowflake,
  X,
} from "lucide-react";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ClinicalMetric from "../components/ClinicalMetric";
import PageHeader from "../components/Header";
import ListToolbar from "../components/ListToolbar";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Panel, PanelHeader } from "../components/Panel";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import useAuth from "../hooks/useAuth";
import useToast from "../hooks/useToast";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";
import { canRecordFridgeTemperature } from "../utils/access";

const emptySummary = {
  latest: null,
  readings_today: 0,
  within_range_today: 0,
  out_of_range_today: 0,
  has_reading_today: false,
  readings_last_7_days: 0,
};

function formatTimestamp(value) {
  if (!value) return "No reading recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readTemperatureError(error) {
  const data = error.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) return String(firstMessage);
  }

  return "The temperature reading could not be recorded. Check the connection and try again.";
}

function RangeBadge({ reading }) {
  return (
    <Badge
      icon={reading.is_within_range ? CheckCircle2 : ShieldAlert}
      tone={reading.is_within_range ? "success" : "danger"}
    >
      {reading.range_status_label}
    </Badge>
  );
}

function TemperatureForm({ onCancel, onSaved }) {
  const toast = useToast();
  const [temperature, setTemperature] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const numericTemperature = Number(temperature);
  const hasNumericTemperature = temperature !== ""
    && Number.isFinite(numericTemperature);
  const isOutOfRange = hasNumericTemperature
    && (numericTemperature < 2 || numericTemperature > 8);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.post("/fridge-temperature-logs/", {
        temperature_celsius: temperature,
        action_taken: actionTaken.trim(),
        notes: notes.trim(),
      });
      toast.success(
        "Temperature reading recorded",
        isOutOfRange
          ? "The out-of-range reading and corrective action are now preserved."
          : "The in-range reading is now part of the immutable safety history."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readTemperatureError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Append-only safety evidence"
        icon={Plus}
        title="Record fridge temperature"
        description="The server records the timestamp and staff identity. Saved readings cannot be edited or deleted through normal workflows."
        action={
          <button
            type="button"
            aria-label="Close temperature form"
            className="glass-icon-button"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        }
      />

      <form
        className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="fridge-temperature"
          >
            Temperature (C)
          </label>
          <input
            id="fridge-temperature"
            required
            type="number"
            step="0.1"
            min="-50"
            max="50"
            inputMode="decimal"
            className="field-control mt-2"
            placeholder="For example: 4.5"
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
          />
          <p className="mt-2 text-xs font-semibold text-slate-500">
            The displayed operating range is 2.0 C to 8.0 C inclusive.
          </p>
        </div>

        <div
          className={`rounded-2xl border p-4 ${
            isOutOfRange
              ? "border-rose-200 bg-rose-50/80"
              : "border-cyan-200 bg-cyan-50/65"
          }`}
          aria-live="polite"
        >
          <p className="flex items-center gap-2 text-sm font-black text-slate-900">
            {isOutOfRange ? (
              <ShieldAlert aria-hidden="true" size={18} className="text-rose-700" />
            ) : (
              <Snowflake aria-hidden="true" size={18} className="text-cyan-800" />
            )}
            {isOutOfRange
              ? "Corrective action required"
              : "Enter the observed reading"}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isOutOfRange
              ? "This reading is outside the displayed range and cannot be saved without an action statement."
              : "An in-range reading can be saved without corrective action."}
          </p>
        </div>

        <div className="lg:col-span-2">
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="fridge-corrective-action"
          >
            Corrective action {isOutOfRange ? "(required)" : "(if needed)"}
          </label>
          <textarea
            id="fridge-corrective-action"
            required={isOutOfRange}
            rows="3"
            maxLength="2000"
            className="field-control mt-2 resize-y"
            placeholder="Describe the local action taken and escalation."
            value={actionTaken}
            onChange={(event) => setActionTaken(event.target.value)}
          />
        </div>

        <div className="lg:col-span-2">
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="fridge-notes"
          >
            Additional notes
          </label>
          <textarea
            id="fridge-notes"
            rows="2"
            maxLength="1000"
            className="field-control mt-2 resize-y"
            placeholder="Optional local context."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {error && (
          <p
            className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm font-semibold text-rose-800 lg:col-span-2"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={
              !hasNumericTemperature
              || (isOutOfRange && !actionTaken.trim())
            }
            loading={isSubmitting}
            type="submit"
          >
            Record reading
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function FridgeMonitoring() {
  const { user } = useAuth();
  const canRecord = canRecordFridgeTemperature(user);
  const [page, setPage] = useState(1);
  const [rangeFilter, setRangeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showForm, setShowForm] = useState(false);

  const readingPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "50",
    });
    if (rangeFilter) params.set("range_status", rangeFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    return `/fridge-temperature-logs/?${params.toString()}`;
  }, [dateFrom, dateTo, page, rangeFilter]);

  const {
    data: readingData,
    error: readingError,
    isLoading,
    isReloading,
    reload: reloadReadings,
  } = useApiResource(
    readingPath,
    "Fridge temperature history could not be retrieved.",
    { count: 0, next: null, previous: null, results: [] }
  );
  const {
    data: summary,
    reload: reloadSummary,
  } = useApiResource(
    "/fridge-temperature-logs/summary/",
    "Fridge monitoring summary could not be retrieved.",
    emptySummary
  );

  const readings = readingData?.results || [];
  const totalReadings = readingData?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalReadings / 50));
  const latest = summary?.latest;

  const reloadAll = async () => {
    await Promise.allSettled([reloadReadings(), reloadSummary()]);
  };

  const changeFilter = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Cold-chain safety evidence"
        icon={ThermometerSnowflake}
        title="Fridge monitoring"
        description="Record and review manual pharmacy fridge checks with immutable history and visible corrective-action controls."
        actions={
          <>
            {canRecord && (
              <Button icon={Plus} onClick={() => setShowForm(true)}>
                Record temperature
              </Button>
            )}
            <Button
              icon={RotateCw}
              loading={isReloading}
              variant="secondary"
              onClick={reloadAll}
            >
              Refresh readings
            </Button>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ClinicalMetric
          icon={ThermometerSnowflake}
          label="Latest reading"
          tone={
            latest
              ? latest.is_within_range
                ? "ready"
                : "critical"
              : "neutral"
          }
          value={latest ? `${latest.temperature_celsius} C` : "--"}
          description={latest ? formatTimestamp(latest.recorded_at) : "No history"}
        />
        <ClinicalMetric
          icon={ClipboardCheck}
          label="Checks today"
          tone="info"
          value={summary?.readings_today || 0}
          description={
            summary?.has_reading_today
              ? "Daily evidence present"
              : "No reading recorded today"
          }
        />
        <ClinicalMetric
          icon={ShieldAlert}
          label="Outside range"
          tone={(summary?.out_of_range_today || 0) > 0 ? "critical" : "ready"}
          value={summary?.out_of_range_today || 0}
          description="Corrective action required"
        />
        <ClinicalMetric
          icon={Refrigerator}
          label="Last 7 days"
          tone="neutral"
          value={summary?.readings_last_7_days || 0}
          description="Immutable readings"
        />
      </section>

      <Panel className="mb-6 overflow-hidden border-cyan-200/70">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-900 shadow-sm">
            <Snowflake aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-800">
              Displayed operating range
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              2.0 C to 8.0 C inclusive
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              This manual log does not replace calibrated equipment, local
              procedures, or professional escalation.
            </p>
          </div>
          {latest && <RangeBadge reading={latest} />}
        </div>
      </Panel>

      {showForm && canRecord && (
        <TemperatureForm
          onCancel={() => setShowForm(false)}
          onSaved={reloadAll}
        />
      )}

      <Panel className="overflow-hidden">
        <PanelHeader
          eyebrow="Append-only register"
          icon={ClipboardCheck}
          title="Temperature history"
          description="Every record preserves the server timestamp and staff identity. Existing entries cannot be changed through this workspace."
        />

        <ListToolbar
          shown={!isLoading && !readingError ? readings.length : null}
          total={!isLoading && !readingError ? totalReadings : null}
          unit="readings on this page"
          filters={
            <div className="grid w-full gap-3 sm:grid-cols-3">
              <label className="sr-only" htmlFor="fridge-range-filter">
                Filter by temperature range status
              </label>
              <select
                id="fridge-range-filter"
                className="field-control font-semibold"
                value={rangeFilter}
                onChange={(event) =>
                  changeFilter(setRangeFilter)(event.target.value)
                }
              >
                <option value="">All readings</option>
                <option value="WITHIN_RANGE">Within 2-8 C</option>
                <option value="OUT_OF_RANGE">Outside 2-8 C</option>
              </select>

              <div>
                <label
                  className="sr-only"
                  htmlFor="fridge-date-from"
                >
                  Readings from date
                </label>
                <input
                  id="fridge-date-from"
                  type="date"
                  className="field-control"
                  value={dateFrom}
                  onChange={(event) =>
                    changeFilter(setDateFrom)(event.target.value)
                  }
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="fridge-date-to">
                  Readings to date
                </label>
                <input
                  id="fridge-date-to"
                  type="date"
                  className="field-control"
                  value={dateTo}
                  onChange={(event) =>
                    changeFilter(setDateTo)(event.target.value)
                  }
                />
              </div>
            </div>
          }
        />

        {isLoading ? (
          <LoadingState label="Loading fridge temperature history..." />
        ) : readingError ? (
          <ErrorState message={readingError} onRetry={reloadAll} />
        ) : readings.length === 0 ? (
          <EmptyState
            icon={ThermometerSnowflake}
            title="No matching temperature readings"
            message="Adjust the filters or record the first manual fridge check."
            action={
              canRecord ? (
                <Button icon={Plus} onClick={() => setShowForm(true)}>
                  Record first reading
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableShell
                label="Fridge temperature history"
                minWidth="980px"
              >
                <thead>
                  <tr>
                    <th scope="col">Recorded</th>
                    <th scope="col">Temperature</th>
                    <th scope="col">Range status</th>
                    <th scope="col">Recorded by</th>
                    <th scope="col">Corrective action / notes</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((reading) => (
                    <tr key={reading.id}>
                      <td>
                        <p className="font-bold text-slate-800">
                          {formatTimestamp(reading.recorded_at)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Immutable record #{reading.id}
                        </p>
                      </td>
                      <td>
                        <p className="text-lg font-black text-slate-950">
                          {reading.temperature_celsius} C
                        </p>
                      </td>
                      <td>
                        <RangeBadge reading={reading} />
                      </td>
                      <td>
                        <p className="font-bold text-slate-700">
                          {reading.recorded_by_display}
                        </p>
                      </td>
                      <td className="max-w-md">
                        {reading.action_taken ? (
                          <p className="text-sm font-semibold leading-6 text-rose-800">
                            Action: {reading.action_taken}
                          </p>
                        ) : (
                          <p className="text-sm font-semibold text-cyan-800">
                            No corrective action required
                          </p>
                        )}
                        {reading.notes && (
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {reading.notes}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>

            <div className="grid gap-4 p-4 lg:hidden">
              {readings.map((reading) => (
                <article
                  key={reading.id}
                  className="rounded-3xl border border-white/80 bg-white/55 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black text-slate-950">
                        {reading.temperature_celsius} C
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {formatTimestamp(reading.recorded_at)}
                      </p>
                    </div>
                    <RangeBadge reading={reading} />
                  </div>

                  <p className="mt-4 text-sm font-bold text-slate-700">
                    Recorded by {reading.recorded_by_display}
                  </p>
                  {reading.action_taken && (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/75 p-4">
                      <p className="text-xs font-black uppercase tracking-wider text-rose-800">
                        Corrective action
                      </p>
                      <p className="mt-2 text-sm leading-6 text-rose-900">
                        {reading.action_taken}
                      </p>
                    </div>
                  )}
                  {reading.notes && (
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      {reading.notes}
                    </p>
                  )}
                </article>
              ))}
            </div>

            <nav
              className="flex flex-col gap-3 border-t border-white/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              aria-label="Fridge temperature pagination"
            >
              <p className="text-sm font-semibold text-slate-500">
                Page {page} of {totalPages} - {totalReadings} total readings
              </p>
              <div className="flex gap-3">
                <Button
                  disabled={!readingData.previous}
                  variant="secondary"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={!readingData.next}
                  variant="secondary"
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default FridgeMonitoring;
