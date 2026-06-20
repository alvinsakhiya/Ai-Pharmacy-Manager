import { useState } from "react";

import { usePermissions } from "../../auth/usePermissions";
import { Modal } from "../../components/ui/Modal";
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

    await completeReview.mutateAsync(completeTarget.id);
    setCompleteTarget(null);
  }

  async function confirmCancel() {
    if (!cancelTarget) {
      return;
    }

    await cancelReview.mutateAsync(cancelTarget.id);
    setCancelTarget(null);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-950">Reviews</h2>
        {canManage ? (
          <button
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            onClick={() => setCreateModalOpen(true)}
            type="button"
          >
            Add review
          </button>
        ) : null}
      </div>

      {reviewsQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-600">Loading reviews...</p>
      ) : null}

      {reviewsQuery.isError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">
            Could not load reviews.
          </p>
          <button
            className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void reviewsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {reviewsQuery.isSuccess && reviewsQuery.data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No reviews for this patient.
        </p>
      ) : null}

      {reviewsQuery.isSuccess && reviewsQuery.data.length > 0 ? (
        <div className="mt-4 space-y-4">
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
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-slate-700">
            This review will be marked completed.
          </p>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              onClick={() => setCompleteTarget(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={completeReview.isPending}
              onClick={() => void confirmComplete()}
              type="button"
            >
              {completeReview.isPending ? "Completing..." : "Complete"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel review?"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-slate-700">
            This review will be marked cancelled.
          </p>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              onClick={() => setCancelTarget(null)}
              type="button"
            >
              Keep review
            </button>
            <button
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={cancelReview.isPending}
              onClick={() => void confirmCancel()}
              type="button"
            >
              {cancelReview.isPending ? "Cancelling..." : "Cancel review"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
