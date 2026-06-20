import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelReview,
  completeReview,
  createReview,
  getReviews,
  type ReviewCreateBody,
  type ReviewListParams,
} from "./reviewsApi";

export function useReviewsQuery(params?: ReviewListParams) {
  return useQuery({
    queryKey: ["reviews", "list", params ?? {}],
    queryFn: () => getReviews(params),
  });
}

export function usePatientReviewsQuery(patientId: number) {
  return useQuery({
    queryKey: ["reviews", "patient", patientId],
    queryFn: () => getReviews({ patient: patientId }),
    enabled: Number.isFinite(patientId),
  });
}

function useInvalidateReviews() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ["reviews"] });
  };
}

export function useCreateReview() {
  const invalidateReviews = useInvalidateReviews();

  return useMutation({
    mutationFn: (body: ReviewCreateBody) => createReview(body),
    onSuccess: invalidateReviews,
  });
}

export function useCompleteReview() {
  const invalidateReviews = useInvalidateReviews();

  return useMutation({
    mutationFn: (id: number) => completeReview(id),
    onSuccess: invalidateReviews,
  });
}

export function useCancelReview() {
  const invalidateReviews = useInvalidateReviews();

  return useMutation({
    mutationFn: (id: number) => cancelReview(id),
    onSuccess: invalidateReviews,
  });
}
