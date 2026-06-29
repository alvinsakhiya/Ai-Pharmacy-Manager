import { useMemo, useState } from "react";

import {
  AlertTriangle,
  ClipboardList,
  Clock3,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { KpiCard } from "../../components/ui/KpiCard";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { inputClass, labelClass, selectClass } from "../../components/ui/forms";
import { cn } from "../../lib/cn";
import { scopeLabel } from "../../lib/scope";
import { usePatientsQuery } from "../patients/usePatients";
import { ReviewCard } from "./ReviewCard";
import { ReviewFormModal } from "./ReviewFormModal";
import type { Review, ReviewPriority, ReviewStatus } from "./reviewsApi";
import {
  useCancelReview,
  useCompleteReview,
  useReviewsQuery,
} from "./useReviews";

function reviewSearchText(review: Review): string {
  return [
    review.patient_reference,
    review.cycle_reference,
    review.status,
    review.priority,
    review.assigned_to_email,
    review.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function activeFilterLabel({
  status,
  priority,
  overdueOnly,
  searchQuery,
}: {
  status: ReviewStatus | "";
  priority: ReviewPriority | "";
  overdueOnly: boolean;
  searchQuery: string;
}): string {
  const active = [
    status !== "",
    priority !== "",
    overdueOnly,
    searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  return active === 0
    ? "All reviews"
    : `${active} active filter${active === 1 ? "" : "s"}`;
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysUntilDue(review: Review, today: Date): number | null {
  if (!review.due_date) {
    return null;
  }
  const dueDate = new Date(review.due_date);
  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }
  const milliseconds = startOfDay(dueDate).getTime() - startOfDay(today).getTime();
  return Math.round(milliseconds / 86_400_000);
}

function isOpenReview(review: Review): boolean {
  return review.status === "PENDING" || review.status === "IN_REVIEW";
}

function isOverdueReview(review: Review, today: Date): boolean {
  const dueDays = daysUntilDue(review, today);
  return review.is_overdue || (dueDays !== null && dueDays < 0);
}

function needsAttention(review: Review, today: Date): boolean {
  return (
    isOpenReview(review) &&
    (isOverdueReview(review, today) ||
      review.priority === "ATTENTION" ||
      review.priority === "URGENT")
  );
}

function isDueSoon(review: Review, today: Date): boolean {
  const dueDays = daysUntilDue(review, today);
  return (
    isOpenReview(review) &&
    !needsAttention(review, today) &&
    dueDays !== null &&
    dueDays >= 0 &&
    dueDays <= 7
  );
}

function reviewGroupLabel(review: Review, today: Date): string {
  if (needsAttention(review, today)) {
    return "Needs attention";
  }
  if (isDueSoon(review, today)) {
    return "Due soon";
  }
  if (isOpenReview(review)) {
    return "Open reviews";
  }
  if (review.status === "COMPLETED") {
    return "Completed";
  }
  return "Earlier / archived";
}

function reviewGroupId(label: string): string {
  return `review-group-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function groupReviews(reviews: Review[], today: Date) {
  const groups = [
    {
      label: "Needs attention",
      description: "Overdue, attention, or urgent reviews to check first.",
      reviews: [] as Review[],
    },
    {
      label: "Due soon",
      description: "Open reviews due within the next seven days.",
      reviews: [] as Review[],
    },
    {
      label: "Open reviews",
      description: "Open operational reviews without an urgent date signal.",
      reviews: [] as Review[],
    },
    {
      label: "Completed",
      description: "Reviews already completed in this view.",
      reviews: [] as Review[],
    },
    {
      label: "Earlier / archived",
      description: "Cancelled or retained review records.",
      reviews: [] as Review[],
    },
  ];

  for (const review of reviews) {
    const label = reviewGroupLabel(review, today);
    groups.find((group) => group.label === label)?.reviews.push(review);
  }

  return groups.filter((group) => group.reviews.length > 0);
}

function ReviewGroupSection({
  canManage,
  group,
  onCancel,
  onComplete,
}: {
  canManage: boolean;
  group: ReturnType<typeof groupReviews>[number];
  onCancel: (review: Review) => void;
  onComplete: (review: Review) => void;
}) {
  const groupId = reviewGroupId(group.label);

  return (
    <section aria-labelledby={groupId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={groupId} className="text-base font-extrabold text-ink">
            {group.label}
          </h2>
          <p className="mt-1 text-sm text-muted">{group.description}</p>
        </div>
        <Badge variant="neutral">
          {group.reviews.length.toLocaleString()} review
          {group.reviews.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {group.reviews.map((review) => (
          <ReviewCard
            canManage={canManage}
            key={review.id}
            onCancel={onCancel}
            onComplete={onComplete}
            review={review}
          />
        ))}
      </div>
    </section>
  );
}

export function ReviewsScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { success, error } = useToast();
  const canManage = can("review.manage");
  const [status, setStatus] = useState<ReviewStatus | "">("");
  const [priority, setPriority] = useState<ReviewPriority | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Review | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Review | null>(null);
  const reviewsQuery = useReviewsQuery({
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(overdueOnly ? { overdue: true } : {}),
  });
  const patientsQuery = usePatientsQuery();
  const completeReview = useCompleteReview();
  const cancelReview = useCancelReview();
  const today = useMemo(() => new Date(), []);
  const dateLabel = useMemo(
    () =>
      today.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [today],
  );
  const userScopeLabel = user ? scopeLabel(user) : "Scope unavailable";

  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const filteredReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return reviews;
    }

    return reviews.filter((review) => reviewSearchText(review).includes(query));
  }, [reviews, searchQuery]);
  const groupedReviews = useMemo(
    () => groupReviews(filteredReviews, today),
    [filteredReviews, today],
  );

  const summary = useMemo(
    () => ({
      open: filteredReviews.filter(isOpenReview).length,
      dueSoon: filteredReviews.filter((review) => isDueSoon(review, today)).length,
      overdue: filteredReviews.filter((review) => isOverdueReview(review, today))
        .length,
      completed: filteredReviews.filter(
        (review) => review.status === "COMPLETED",
      ).length,
      attention: filteredReviews.filter(
        (review) => needsAttention(review, today),
      ).length,
    }),
    [filteredReviews, today],
  );

  const filterLabel = activeFilterLabel({
    overdueOnly,
    priority,
    searchQuery,
    status,
  });

  async function confirmComplete() {
    if (!completeTarget) {
      return;
    }

    try {
      await completeReview.mutateAsync(completeTarget.id);
      success("Review completed");
      setCompleteTarget(null);
    } catch {
      error("Could not complete review");
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) {
      return;
    }

    try {
      await cancelReview.mutateAsync(cancelTarget.id);
      success("Review cancelled");
      setCancelTarget(null);
    } catch {
      error("Could not cancel review");
    }
  }

  return (
    <div className="space-y-5">
      <header className="animate-fade-in-up space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Decision queue
            </p>
            <h1 className="mt-1.5 text-[30px] font-extrabold tracking-[-0.025em] text-ink sm:text-[34px]">
              Reviews
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Review pending pharmacy decisions before action.
            </p>
          </div>
          {canManage ? (
            <Button
              variant="primary"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              New review
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{userScopeLabel}</Badge>
          <Badge variant="info">Human review required</Badge>
          <Badge variant="neutral">{filterLabel}</Badge>
          <Badge variant="neutral">{dateLabel}</Badge>
        </div>
      </header>

      {reviewsQuery.isSuccess ? (
        <section
          aria-label="Reviews summary"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          <KpiCard
            label="Open reviews"
            value={summary.open}
            note={`${reviews.length} reviews in source view`}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <KpiCard
            label="Due soon"
            value={summary.dueSoon}
            note="Open reviews due within 7 days"
            icon={<Clock3 className="h-4 w-4" />}
          />
          <KpiCard
            label="Overdue"
            value={summary.overdue}
            note="Review before action"
            icon={<XCircle className="h-4 w-4" />}
          />
          <KpiCard
            label="Completed"
            value={summary.completed}
            note="Completed review records"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <KpiCard
            label="Needs attention"
            value={summary.attention}
            note="Overdue, attention, or urgent"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </section>
      ) : null}

      <Panel>
        <PanelHeader
          title="Review controls"
          subtitle={
            reviewsQuery.isSuccess
              ? `${filteredReviews.length} of ${reviews.length} reviews shown`
              : "Filter the review queue"
          }
          icon={<Filter className="h-4 w-4" aria-hidden="true" />}
        />
        <PanelBody>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className={labelClass}>
              Search reviews
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  className={cn(inputClass, "pl-9")}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Reference, notes, assignee..."
                  type="search"
                  value={searchQuery}
                />
              </div>
            </label>

            <label className={labelClass}>
              Status
              <select
                className={selectClass}
                onChange={(event) =>
                  setStatus(event.target.value as ReviewStatus | "")
                }
                value={status}
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_REVIEW">In review</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>

            <label className={labelClass}>
              Priority
              <select
                className={selectClass}
                onChange={(event) =>
                  setPriority(event.target.value as ReviewPriority | "")
                }
                value={priority}
              >
                <option value="">All priorities</option>
                <option value="ROUTINE">Routine</option>
                <option value="ATTENTION">Attention</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>

            <label className="flex items-end gap-2.5 text-[13px] font-semibold text-ink-soft">
              <input
                checked={overdueOnly}
                className="mb-2 h-4 w-4 rounded border-line-strong text-brand focus:ring-brand-ring"
                onChange={(event) => setOverdueOnly(event.target.checked)}
                type="checkbox"
              />
              <span className="pb-1.5">Overdue only</span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            <span>{filterLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Existing review data only</span>
          </div>
        </PanelBody>
      </Panel>

      {reviewsQuery.isLoading ? (
        <Panel>
          <PanelBody>
            <p className="sr-only">Loading review queue...</p>
            <SkeletonRows rows={4} />
          </PanelBody>
        </Panel>
      ) : null}

      {reviewsQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<ClipboardList className="h-6 w-6" />}
          title="Could not load reviews."
          description="Something went wrong loading the review queue. Try again."
          action={
            <Button variant="danger" onClick={() => void reviewsQuery.refetch()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {reviewsQuery.isSuccess && filteredReviews.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No reviews match the current view."
          description="Adjust the filters or refresh the queue."
        />
      ) : null}

      {reviewsQuery.isSuccess && filteredReviews.length > 0 ? (
        <section aria-label="Grouped review queue" className="stagger space-y-6">
          {groupedReviews.map((group) => (
            <ReviewGroupSection
              canManage={canManage}
              group={group}
              key={group.label}
              onCancel={setCancelTarget}
              onComplete={setCompleteTarget}
            />
          ))}
        </section>
      ) : null}

      <ReviewFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        patientOptions={patientsQuery.data ?? []}
      />

      <Modal
        isOpen={completeTarget !== null}
        onClose={() => setCompleteTarget(null)}
        title="Complete review?"
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-ink-soft">
            This review will be marked completed.
          </p>
          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button variant="secondary" onClick={() => setCompleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={completeReview.isPending}
              onClick={() => void confirmComplete()}
            >
              {completeReview.isPending ? "Completing..." : "Complete"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel review?"
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-ink-soft">
            This review will be marked cancelled.
          </p>
          <div className="flex justify-end gap-3 border-t border-line pt-5">
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Keep review
            </Button>
            <Button
              variant="danger"
              disabled={cancelReview.isPending}
              onClick={() => void confirmCancel()}
            >
              {cancelReview.isPending ? "Cancelling..." : "Cancel review"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
