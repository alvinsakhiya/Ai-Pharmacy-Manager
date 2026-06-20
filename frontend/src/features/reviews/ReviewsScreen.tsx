import { useState } from "react";

import { usePermissions } from "../../auth/usePermissions";
import { Modal } from "../../components/ui/Modal";
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              Pharmacist reviews
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Reviews
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Operational pharmacist review queue.
            </p>
          </div>
          {canManage ? (
            <button
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              onClick={() => setCreateModalOpen(true)}
              type="button"
            >
              New review
            </button>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
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

          <label className="text-sm font-medium text-slate-700">
            Priority
            <select
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
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

          <label className="flex items-end gap-3 text-sm font-medium text-slate-700">
            <input
              checked={overdueOnly}
              className="mb-2 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              onChange={(event) => setOverdueOnly(event.target.checked)}
              type="checkbox"
            />
            <span className="pb-1.5">Overdue only</span>
          </label>
        </div>
      </section>

      {reviewsQuery.isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Loading reviews...
        </section>
      ) : null}

      {reviewsQuery.isError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <h2 className="text-lg font-bold text-red-900">
            Could not load reviews.
          </h2>
          <button
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            onClick={() => void reviewsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </section>
      ) : null}

      {reviewsQuery.isSuccess && reviewsQuery.data.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          No reviews.
        </section>
      ) : null}

      {reviewsQuery.isSuccess && reviewsQuery.data.length > 0 ? (
        <section className="space-y-4">
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
    </div>
  );
}
