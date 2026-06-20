import {
  ReviewOverdueBadge,
  ReviewPriorityBadge,
  ReviewStatusBadge,
} from "./ReviewBadges";
import type { Review } from "./reviewsApi";

interface ReviewCardProps {
  review: Review;
  canManage: boolean;
  onComplete: (review: Review) => void;
  onCancel: (review: Review) => void;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export function ReviewCard({
  review,
  canManage,
  onComplete,
  onCancel,
}: ReviewCardProps) {
  const canAct = canManage && ["PENDING", "IN_REVIEW"].includes(review.status);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <ReviewStatusBadge status={review.status} />
            <ReviewPriorityBadge priority={review.priority} />
            {review.is_overdue ? <ReviewOverdueBadge /> : null}
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-950">
            {review.patient_reference}
          </h2>
          {review.cycle_reference ? (
            <p className="mt-1 text-sm text-slate-600">
              Cycle {review.cycle_reference}
            </p>
          ) : null}
        </div>

        {canAct ? (
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              onClick={() => onComplete(review)}
              type="button"
            >
              Complete
            </button>
            <button
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              onClick={() => onCancel(review)}
              type="button"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <Detail label="Due date" value={formatDate(review.due_date)} />
        <Detail
          label="Assigned to"
          value={review.assigned_to_email ?? "Unassigned"}
        />
        <Detail label="Updated" value={formatDateTime(review.updated_at)} />
      </dl>

      {review.notes.trim() ? (
        <p className="mt-5 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {review.notes}
        </p>
      ) : null}
    </article>
  );
}
