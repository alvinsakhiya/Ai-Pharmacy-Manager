import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
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

function Detail({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        <span aria-hidden="true" className="text-muted-soft">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-ink-soft tnum">{value}</dd>
    </div>
  );
}

function reviewTypeLabel(review: Review): string {
  return review.dosette_cycle || review.cycle_reference
    ? "Dosette review"
    : "General review";
}

export function ReviewCard({
  review,
  canManage,
  onComplete,
  onCancel,
}: ReviewCardProps) {
  const canAct = canManage && ["PENDING", "IN_REVIEW"].includes(review.status);

  return (
    <article className="interactive-card animate-fade-in-up overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <ReviewStatusBadge status={review.status} />
            <ReviewPriorityBadge priority={review.priority} />
            <Badge
              variant={review.cycle_reference ? "info" : "neutral"}
              icon={
                review.cycle_reference ? (
                  <PackageCheck className="h-3.5 w-3.5" />
                ) : (
                  <ClipboardCheck className="h-3.5 w-3.5" />
                )
              }
            >
              {reviewTypeLabel(review)}
            </Badge>
            {review.is_overdue ? <ReviewOverdueBadge /> : null}
          </div>
          <h2 className="mt-4 text-[17px] font-extrabold tracking-[-0.01em] text-ink tnum">
            Review for {review.patient_reference}
          </h2>
          {review.cycle_reference ? (
            <p className="mt-1 text-sm text-muted">
              Cycle {review.cycle_reference}
            </p>
          ) : null}
        </div>

        {canAct ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              leadingIcon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => onComplete(review)}
            >
              Complete
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<XCircle className="h-4 w-4" />}
              onClick={() => onCancel(review)}
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </div>

      <dl className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
        <Detail
          label="Due date"
          value={formatDate(review.due_date)}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
        />
        <Detail
          label="Assigned to"
          value={review.assigned_to_email ?? "Unassigned"}
          icon={<UserRound className="h-3.5 w-3.5" />}
        />
        <Detail
          label="Created"
          value={formatDateTime(review.created_at)}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
        />
        <Detail
          label="Updated"
          value={formatDateTime(review.updated_at)}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
        />
      </dl>

      {review.notes.trim() ? (
        <p className="mx-5 mb-5 whitespace-pre-wrap rounded-xl border border-line bg-surface-subtle p-4 text-sm leading-relaxed text-ink-soft">
          {review.notes}
        </p>
      ) : null}
    </article>
  );
}
