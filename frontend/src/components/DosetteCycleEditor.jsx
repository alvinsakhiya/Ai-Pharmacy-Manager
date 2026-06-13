import { useState } from "react";
import { CalendarClock, Save, X } from "lucide-react";
import Button from "./Button";
import { Panel, PanelHeader } from "./Panel";
import useToast from "../hooks/useToast";
import api from "../services/api";

function readCycleError(error) {
  const data = error.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) {
      return String(firstMessage);
    }
  }

  return "The cycle details could not be saved. Check the connection and try again.";
}

function DosetteCycleEditor({ record, onCancel, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    cycle_start_date: record.cycle_start_date || "",
    cycle_length_weeks: String(record.cycle_length_weeks || 4),
    review_date: record.review_date || "",
    is_active: record.is_active,
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cycleLength = Number(form.cycle_length_weeks);
  const isValid =
    Number.isInteger(cycleLength)
    && cycleLength >= 1
    && cycleLength <= 52;

  const updateField = (field) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await api.patch(`/dosette-records/${record.id}/`, {
        cycle_start_date: form.cycle_start_date || null,
        cycle_length_weeks: cycleLength,
        review_date: form.review_date || null,
        is_active: form.is_active,
      });
      toast.success(
        "Dosette cycle updated",
        "The current schedule and immutable change history have been refreshed."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readCycleError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Cycle and review control"
        icon={CalendarClock}
        title={`Update ${record.patient_name}`}
        description={`${record.medication_name} ${record.medication_strength}. Dose values remain unchanged by this form.`}
        action={
          <button
            type="button"
            aria-label="Close cycle editor"
            className="glass-icon-button"
            onClick={onCancel}
          >
            <X aria-hidden="true" size={18} />
          </button>
        }
      />

      <form
        className="grid gap-5 p-5 sm:p-6 lg:grid-cols-3"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="cycle-start-date"
          >
            Cycle start date
          </label>
          <input
            id="cycle-start-date"
            type="date"
            className="field-control mt-2"
            value={form.cycle_start_date}
            onChange={updateField("cycle_start_date")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Optional start date for the current local preparation cycle.
          </p>
        </div>

        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="cycle-length-weeks"
          >
            Cycle length
          </label>
          <input
            id="cycle-length-weeks"
            type="number"
            required
            min="1"
            max="52"
            step="1"
            className="field-control mt-2"
            value={form.cycle_length_weeks}
            onChange={updateField("cycle_length_weeks")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Whole weeks from 1 to 52. Existing schedules default to four.
          </p>
        </div>

        <div>
          <label
            className="text-sm font-bold text-slate-700"
            htmlFor="dosette-review-date"
          >
            Next review date
          </label>
          <input
            id="dosette-review-date"
            type="date"
            className="field-control mt-2"
            value={form.review_date}
            onChange={updateField("review_date")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Optional date for the next schedule review.
          </p>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm font-bold text-slate-700 lg:col-span-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={form.is_active}
            onChange={updateField("is_active")}
          />
          Active schedule included in picking and forecast demand
        </label>

        {error && (
          <div
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 lg:col-span-3"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            icon={Save}
            loading={isSubmitting}
            disabled={!isValid}
          >
            Save cycle details
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export default DosetteCycleEditor;
