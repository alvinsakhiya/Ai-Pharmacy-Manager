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

  const summary = useMemo(
    () => ({
      visible: filteredReviews.length,
      pending: filteredReviews.filter(
        (review) =>
          review.status === "PENDING" || review.status === "IN_REVIEW",
      ).length,
      completed: filteredReviews.filter(
        (review) => review.status === "COMPLETED",
      ).length,
      cancelled: filteredReviews.filter(
        (review) => review.status === "CANCELLED",
      ).length,
      attention: filteredReviews.filter(
        (review) =>
          review.priority === "ATTENTION" || review.priority === "URGENT",
      ).length,
      overdue: filteredReviews.filter((review) => review.is_overdue).length,
    }),
    [filteredReviews],
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
            label="Visible reviews"
            value={summary.visible}
            note={`${reviews.length} reviews in source view`}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <KpiCard
            label="Pending reviews"
            value={summary.pending}
            note="Pending or in review"
            icon={<Clock3 className="h-4 w-4" />}
          />
          <KpiCard
            label="Completed reviews"
            value={summary.completed}
            note="Completed review records"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <KpiCard
            label="Attention priority"
            value={summary.attention}
            note="Attention or urgent priority"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <KpiCard
            label="Overdue"
            value={summary.overdue}
            note={`${summary.cancelled} cancelled records`}
            icon={<XCircle className="h-4 w-4" />}
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
        <section className="stagger space-y-4">
          {filteredReviews.map((review) => (
            <ReviewCard
              canManage={canManage}
              key={review.id}
              onCancel={setCancelTarget}
              onComplete={setCompleteTarget}
              review={review}
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
