import type { ReviewPriority, ReviewStatus } from "./reviewsApi";

const STATUS_STYLES: Record<ReviewStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  IN_REVIEW: "bg-sky-50 text-sky-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const PRIORITY_STYLES: Record<ReviewPriority, string> = {
  ROUTINE: "bg-slate-100 text-slate-700",
  ATTENTION: "bg-amber-50 text-amber-700",
  URGENT: "bg-red-50 text-red-700",
};

function label(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function Badge({
  children,
  className,
}: {
  children: string;
  className: string;
}) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{label(status)}</Badge>;
}

export function ReviewPriorityBadge({
  priority,
}: {
  priority: ReviewPriority;
}) {
  return <Badge className={PRIORITY_STYLES[priority]}>{label(priority)}</Badge>;
}

export function ReviewOverdueBadge() {
  return <Badge className="bg-red-50 text-red-700">Overdue</Badge>;
}
