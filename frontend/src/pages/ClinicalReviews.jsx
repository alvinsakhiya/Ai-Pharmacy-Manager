import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardPlus,
  FilePenLine,
  NotebookText,
  RotateCw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import SearchField from "../components/SearchField";
import { Panel, PanelHeader } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ListToolbar from "../components/ListToolbar";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import useToast from "../hooks/useToast";
import api from "../services/api";
import { formatDate } from "../utils/helpers";

const categories = [
  ["GENERAL_REVIEW", "General review"],
  ["DOSETTE_REVIEW", "Dosette review"],
  ["MEDICATION_CONCERN", "Medication concern"],
  ["STOCK_RELATED", "Stock-related note"],
  ["FOLLOW_UP_REQUIRED", "Follow-up required"],
];

const followUpStatuses = [
  ["NOT_REQUIRED", "Not required"],
  ["REQUIRED", "Required"],
  ["IN_PROGRESS", "In progress"],
  ["COMPLETED", "Completed"],
];

const statusConfig = {
  NOT_REQUIRED: { icon: ShieldCheck, tone: "slate" },
  REQUIRED: { icon: CircleAlert, tone: "warning" },
  IN_PROGRESS: { icon: CalendarClock, tone: "blue" },
  COMPLETED: { icon: CheckCircle2, tone: "success" },
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

function readClinicalReviewError(error) {
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

  return "The clinical review could not be saved. Check the connection and try again.";
}

function FollowUpBadge({ review }) {
  const config = statusConfig[review.follow_up_status] || statusConfig.NOT_REQUIRED;

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {review.follow_up_status_label}
    </Badge>
  );
}

function ClinicalReviewForm({ note, patients, onCancel, onSaved }) {
  const toast = useToast();
  const isEditing = Boolean(note);
  const [form, setForm] = useState(() => ({
    patient: note ? String(note.patient) : "",
    category: note?.category || "GENERAL_REVIEW",
    note_text: note?.note_text || "",
    review_date: note?.review_date || "",
    follow_up_status: note?.follow_up_status || "NOT_REQUIRED",
  }));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const payload = {
      ...form,
      patient: Number(form.patient),
      review_date: form.review_date || null,
      note_text: form.note_text.trim(),
    };

    try {
      if (isEditing) {
        await api.patch(`/clinical-reviews/${note.id}/`, payload);
      } else {
        await api.post("/clinical-reviews/", payload);
      }

      toast.success(
        isEditing ? "Clinical review updated" : "Clinical review recorded",
        "The structured review is available to authorised patient-care staff."
      );
      await onSaved();
      onCancel();
    } catch (requestError) {
      setError(readClinicalReviewError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Authorised patient-care record"
        icon={isEditing ? FilePenLine : ClipboardPlus}
        title={isEditing ? "Update clinical review" : "Record clinical review"}
        description={
          isEditing
            ? `Original author: ${note.author_display}. Authorship remains unchanged when the review is updated.`
            : "Capture a structured local review without placing clinical content in the audit log."
        }
        action={
          <button
            type="button"
            aria-label="Close clinical review form"
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
          <label className="text-sm font-bold text-slate-700" htmlFor="review-patient">
            Patient
          </label>
          <select
            id="review-patient"
            required
            className="field-control mt-2"
            value={form.patient}
            onChange={updateField("patient")}
          >
            <option value="">Select a patient</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.first_name} {patient.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="review-category">
            Review category
          </label>
          <select
            id="review-category"
            className="field-control mt-2"
            value={form.category}
            onChange={updateField("category")}
          >
            {categories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="review-date">
            Review or follow-up date
          </label>
          <input
            id="review-date"
            type="date"
            className="field-control mt-2"
            value={form.review_date}
            onChange={updateField("review_date")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Optional. Use this for the next planned review or follow-up.
          </p>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="follow-up-status">
            Follow-up status
          </label>
          <select
            id="follow-up-status"
            className="field-control mt-2"
            value={form.follow_up_status}
            onChange={updateField("follow_up_status")}
          >
            {followUpStatuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="text-sm font-bold text-slate-700" htmlFor="review-note">
            Clinical review note
          </label>
          <textarea
            id="review-note"
            required
            maxLength={5000}
            rows={6}
            className="field-control mt-2 resize-y"
            placeholder="Record the review outcome, concern or agreed follow-up..."
            value={form.note_text}
            onChange={updateField("note_text")}
          />
          <div className="mt-2 flex flex-col gap-1 text-xs leading-5 text-slate-500 sm:flex-row sm:justify-between">
            <span>
              Record only information needed for this local educational workflow.
              This feature does not provide clinical decision support.
            </span>
            <span aria-live="polite">{form.note_text.length} / 5,000</span>
          </div>
        </div>

        {error && (
          <div
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 lg:col-span-2"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            icon={isEditing ? FilePenLine : ClipboardPlus}
            loading={isSubmitting}
            disabled={!form.patient || !form.note_text.trim()}
          >
            {isEditing ? "Save review changes" : "Record review"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function ClinicalReviews() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [patientFilter, setPatientFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formMode, setFormMode] = useState(null);

  const reviewPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "50",
    });

    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (patientFilter) params.set("patient", patientFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("follow_up_status", statusFilter);

    return `/clinical-reviews/?${params.toString()}`;
  }, [categoryFilter, page, patientFilter, searchQuery, statusFilter]);

  const {
    data,
    error,
    isLoading,
    isReloading,
    reload,
  } = useApiResource(
    reviewPath,
    "Clinical reviews could not be retrieved. Check the API connection and try again.",
    { count: 0, next: null, previous: null, results: [] }
  );
  const {
    data: patients,
    error: patientError,
    isLoading: patientsLoading,
  } = useApiResource(
    "/patients/",
    "Patient choices could not be retrieved."
  );

  const reviews = data?.results || [];
  const totalReviews = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalReviews / 50));

  const resetPageAndSet = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Structured patient review"
        title="Clinical reviews"
        description="Record and track authorised patient review notes separately from general patient profile information."
        icon={Stethoscope}
        actions={
          <>
            <Button
              icon={ClipboardPlus}
              onClick={() => setFormMode({ type: "create" })}
            >
              New review
            </Button>
            <Button
              icon={RotateCw}
              loading={isReloading}
              variant="secondary"
              onClick={reload}
            >
              Refresh reviews
            </Button>
          </>
        }
      />

      <section
        className="clinical-grid mb-6 rounded-[1.5rem] border border-blue-200/70 bg-blue-50/55 p-5 sm:p-6"
        aria-labelledby="clinical-boundary-heading"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-white/70 text-blue-800 shadow-sm">
            <ShieldCheck aria-hidden="true" size={21} />
          </div>
          <div>
            <h2
              id="clinical-boundary-heading"
              className="text-base font-bold text-slate-950"
            >
              Local review documentation
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Available only to Managers and Pharmacists. Notes are authored,
              timestamped and audited by record identifier and field name only.
              The system does not diagnose, prescribe or recommend treatment.
            </p>
          </div>
        </div>
      </section>

      {formMode && (
        <ClinicalReviewForm
          key={formMode.note?.id || "new-review"}
          note={formMode.note}
          patients={patients}
          onCancel={() => setFormMode(null)}
          onSaved={reload}
        />
      )}

      {patientError && (
        <div
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
          role="alert"
        >
          {patientError} Existing reviews remain visible, but a new review
          cannot be assigned until patient records reload.
        </div>
      )}

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!isLoading && !error ? reviews.length : null}
          total={!isLoading && !error ? totalReviews : null}
          unit="reviews on this page"
          filters={
            <div className="grid gap-3 sm:grid-cols-2 xl:flex">
              <label className="sr-only" htmlFor="review-patient-filter">
                Filter by patient
              </label>
              <select
                id="review-patient-filter"
                className="field-control min-w-48 font-semibold"
                value={patientFilter}
                onChange={(event) =>
                  resetPageAndSet(setPatientFilter)(event.target.value)
                }
              >
                <option value="">All patients</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="review-category-filter">
                Filter by review category
              </label>
              <select
                id="review-category-filter"
                className="field-control min-w-48 font-semibold"
                value={categoryFilter}
                onChange={(event) =>
                  resetPageAndSet(setCategoryFilter)(event.target.value)
                }
              >
                <option value="">All categories</option>
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="review-status-filter">
                Filter by follow-up status
              </label>
              <select
                id="review-status-filter"
                className="field-control min-w-44 font-semibold"
                value={statusFilter}
                onChange={(event) =>
                  resetPageAndSet(setStatusFilter)(event.target.value)
                }
              >
                <option value="">All follow-up states</option>
                {followUpStatuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <SearchField
            id="clinical-review-search"
            label="Search clinical reviews"
            placeholder="Search patient, review text or author..."
            value={searchQuery}
            onChange={resetPageAndSet(setSearchQuery)}
          />
        </ListToolbar>

        {isLoading || patientsLoading ? (
          <LoadingState label="Loading structured clinical reviews..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={NotebookText}
            title="No matching clinical reviews"
            message="Adjust the filters or record a structured patient review."
            action={
              <Button
                icon={ClipboardPlus}
                onClick={() => setFormMode({ type: "create" })}
              >
                Record first review
              </Button>
            }
          />
        ) : (
          <>
            <TableShell
              className="hidden lg:block"
              label="Structured clinical review records"
              minWidth="1120px"
            >
              <thead>
                <tr>
                  <th>Patient / category</th>
                  <th>Review note</th>
                  <th>Follow-up</th>
                  <th>Review date</th>
                  <th>Author / recorded</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <p className="font-bold text-slate-950">
                        {review.patient_name}
                      </p>
                      <Badge className="mt-2" icon={NotebookText} tone="purple">
                        {review.category_label}
                      </Badge>
                    </td>
                    <td className="max-w-xl">
                      <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                        {review.note_text}
                      </p>
                    </td>
                    <td>
                      <FollowUpBadge review={review} />
                    </td>
                    <td className="whitespace-nowrap text-sm font-semibold text-slate-600">
                      {review.review_date ? formatDate(review.review_date) : "Not scheduled"}
                    </td>
                    <td>
                      <p className="font-bold text-slate-800">{review.author_display}</p>
                      <p className="mt-1 whitespace-nowrap text-xs font-medium text-slate-400">
                        {formatTimestamp(review.created_at)}
                      </p>
                    </td>
                    <td>
                      <Button
                        icon={FilePenLine}
                        variant="secondary"
                        onClick={() => setFormMode({ type: "edit", note: review })}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>

            <div className="divide-y divide-slate-100 lg:hidden">
              {reviews.map((review) => (
                <article key={review.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <UserRound aria-hidden="true" className="text-blue-600" size={18} />
                        <h2 className="font-bold text-slate-950">
                          {review.patient_name}
                        </h2>
                      </div>
                      <Badge className="mt-2" icon={NotebookText} tone="purple">
                        {review.category_label}
                      </Badge>
                    </div>
                    <FollowUpBadge review={review} />
                  </div>

                  <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {review.note_text}
                  </p>

                  <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Review date</dt>
                      <dd className="text-right font-bold text-slate-700">
                        {review.review_date
                          ? formatDate(review.review_date)
                          : "Not scheduled"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Author</dt>
                      <dd className="text-right font-bold text-slate-700">
                        {review.author_display}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Recorded</dt>
                      <dd className="text-right font-semibold text-slate-700">
                        {formatTimestamp(review.created_at)}
                      </dd>
                    </div>
                  </dl>

                  <Button
                    className="mt-4 w-full"
                    icon={FilePenLine}
                    variant="secondary"
                    onClick={() => setFormMode({ type: "edit", note: review })}
                  >
                    Edit structured review
                  </Button>
                </article>
              ))}
            </div>

            <nav
              className="flex flex-col gap-3 border-t border-white/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              aria-label="Clinical review pagination"
            >
              <p className="text-sm font-semibold text-slate-500">
                Page {page} of {totalPages} · {totalReviews} total reviews
              </p>
              <div className="flex gap-3">
                <Button
                  disabled={!data.previous}
                  variant="secondary"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={!data.next}
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

export default ClinicalReviews;
