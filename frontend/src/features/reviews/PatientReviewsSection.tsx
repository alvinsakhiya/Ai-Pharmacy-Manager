import { useState } from "react";

import { ClipboardList, Plus } from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { useDosetteCyclesQuery } from "../dosette/useDosette";
import { ReviewCard } from "./ReviewCard";
import { ReviewFormModal } from "./ReviewFormModal";
import type { Review } from "./reviewsApi";
import {
  useCancelReview,
  useCompleteReview,
  usePatientReviewsQuery,
} from "./useReviews";

interface PatientReviewsSectionProps {
  patientId: number;
}

export function PatientReviewsSection({ patientId }: PatientReviewsSectionProps) {
  const { can } = usePermissions();
  const { success, error } = useToast();
  const canView = can("review.view");
  const canManage = can("review.manage");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Review | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Review | null>(null);
  const reviewsQuery = usePatientReviewsQuery(patientId);
  const cyclesQuery = useDosetteCyclesQuery(patientId);
  const completeReview = useCompleteReview();
  const cancelReview = useCancelReview();

  if (!canView) {
    return null;
  }

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
    <Panel>
      <PanelHeader
        title="Reviews"
        icon={<ClipboardList className="h-4 w-4" />}
        actions={
          canManage ? (
            <Button
              size="sm"
              variant="primary"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              Add review
            </Button>
          ) : null
        }
      />
      <PanelBody className="space-y-4">
        {reviewsQuery.isLoading ? (
          <>
            <p className="sr-only">Loading reviews...</p>
            <SkeletonRows rows={3} />
          </>
        ) : null}

        {reviewsQuery.isError ? (
          <EmptyState
            tone="danger"
            icon={<ClipboardList className="h-6 w-6" />}
            title="Could not load reviews."
            description="Something went wrong loading reviews. Try again."
            action={
              <Button
                variant="danger"
                onClick={() => void reviewsQuery.refetch()}
              >
                Retry
              </Button>
            }
          />
        ) : null}

        {reviewsQuery.isSuccess && reviewsQuery.data.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No reviews for this patient."
          />
        ) : null}

        {reviewsQuery.isSuccess && reviewsQuery.data.length > 0 ? (
          <div className="stagger space-y-4">
            {reviewsQuery.data.map((review) => (
              <ReviewCard
                canManage={canManage}
                key={review.id}
                onCancel={setCancelTarget}
                onComplete={setCompleteTarget}
                review={review}
              />
            ))}
          </div>
        ) : null}
      </PanelBody>

      <ReviewFormModal
        fixedPatientId={patientId}
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        patientCycles={cyclesQuery.data ?? []}
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
    </Panel>
  );
}
