import { requestJson } from "../../lib/apiClient";

export type ReviewStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "COMPLETED"
  | "CANCELLED";

export type ReviewPriority = "ROUTINE" | "ATTENTION" | "URGENT";

export interface Review {
  id: number;
  patient: number;
  patient_reference: string;
  dosette_cycle: number | null;
  cycle_reference: string | null;
  status: ReviewStatus;
  priority: ReviewPriority;
  assigned_to: number | null;
  assigned_to_email: string | null;
  due_date: string | null;
  completed_at: string | null;
  is_overdue: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewListParams {
  status?: ReviewStatus;
  priority?: ReviewPriority;
  overdue?: boolean;
  patient?: number;
}

export interface ReviewCreateBody {
  patient: number;
  dosette_cycle?: number | null;
  priority: ReviewPriority;
  due_date?: string | null;
  notes?: string;
}

export function getReviews(params?: ReviewListParams): Promise<Review[]> {
  const searchParams = new URLSearchParams();

  if (params?.status !== undefined) {
    searchParams.set("status", params.status);
  }
  if (params?.priority !== undefined) {
    searchParams.set("priority", params.priority);
  }
  if (params?.overdue === true) {
    searchParams.set("overdue", "true");
  }
  if (params?.patient !== undefined) {
    searchParams.set("patient", String(params.patient));
  }

  const query = searchParams.toString();
  return requestJson<Review[]>(`/api/reviews/${query ? `?${query}` : ""}`);
}

export function createReview(body: ReviewCreateBody): Promise<Review> {
  return requestJson<Review>("/api/reviews/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export function completeReview(id: number): Promise<Review> {
  return requestJson<Review>(`/api/reviews/${id}/complete/`, {
    method: "POST",
  });
}

export function cancelReview(id: number): Promise<Review> {
  return requestJson<Review>(`/api/reviews/${id}/cancel/`, {
    method: "POST",
  });
}
