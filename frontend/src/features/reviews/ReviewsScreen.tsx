import { useState } from "react";

import { ClipboardList, Plus } from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import {
  labelClass,
  selectClass,
} from "../../components/ui/forms";
import { usePatientsQuery } from "../patients/usePatients";
import { ReviewCard } from "./ReviewCard";
import { ReviewFormModal } from "./ReviewFormModal";
import type { Review, ReviewPriority, ReviewStatus } from "./reviewsApi";
import {
  useCancelReview,
  useCompleteReview,
  useReviewsQuery,
} from "./useReviews";

export function ReviewsScreen() {
  const { can } = usePermissions();
  const { success, error } = useToast();
  const canManage = can("review.manage");
  const [status, setStatus] = useState<ReviewStatus | "">("");
  const [priority, setPriority] = useState<ReviewPriority | "">("");
  const [overdueOnly, setOverdueOnly] = useState(false);
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
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="Pharmacist reviews"
        title="Reviews"
        subtitle="Operational pharmacist review queue."
        actions={
          canManage ? (
            <Button
              variant="primary"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              New review
            </Button>
          ) : null
        }
      />

      <Panel>
        <PanelBody>
          <div className="grid gap-4 md:grid-cols-3">
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
        </PanelBody>
      </Panel>

      {reviewsQuery.isLoading ? (
        <Panel>
          <PanelBody>
            <p className="sr-only">Loading reviews...</p>
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

      {reviewsQuery.isSuccess && reviewsQuery.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No reviews."
          description="No reviews match the current filters."
        />
      ) : null}

      {reviewsQuery.isSuccess && reviewsQuery.data.length > 0 ? (
        <section className="stagger space-y-4">
          {reviewsQuery.data.map((review) => (
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
