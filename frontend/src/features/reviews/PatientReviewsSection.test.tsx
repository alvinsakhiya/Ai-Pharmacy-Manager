import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { DosetteCycle } from "../dosette/dosetteApi";
import * as dosetteApi from "../dosette/dosetteApi";
import { PatientReviewsSection } from "./PatientReviewsSection";
import type { Review } from "./reviewsApi";
import * as reviewsApi from "./reviewsApi";

vi.mock("./reviewsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reviewsApi")>();
  return {
    ...actual,
    cancelReview: vi.fn(),
    completeReview: vi.fn(),
    createReview: vi.fn(),
    getReviews: vi.fn(),
  };
});

vi.mock("../dosette/dosetteApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../dosette/dosetteApi")>();
  return {
    ...actual,
    listDosetteCycles: vi.fn(),
  };
});

const getReviewsMock = vi.mocked(reviewsApi.getReviews);
const listDosetteCyclesMock = vi.mocked(dosetteApi.listDosetteCycles);

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 12,
    patient: 7,
    patient_reference: "SUT-P1",
    dosette_cycle: 21,
    cycle_reference: "MDS-2026-FW07",
    status: "PENDING",
    priority: "ATTENTION",
    assigned_to: null,
    assigned_to_email: null,
    due_date: "2026-07-15",
    completed_at: null,
    is_overdue: false,
    notes: "Review before weekly collection.",
    created_at: "2026-06-20T09:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
    ...overrides,
  };
}

function makeCycle(overrides: Partial<DosetteCycle> = {}): DosetteCycle {
  return {
    id: 21,
    reference: "MDS-2026-FW07",
    patient_reference: "SUT-P1",
    display_label: "SUT-P1 · 1-week supply · 01 Jul 2026 - 07 Jul 2026",
    supply_period_label: "1-week supply",
    frequency: "WEEKLY",
    start_date: "2026-07-01",
    end_date: "2026-07-07",
    due_status: "upcoming",
    days_until_due: 5,
    is_due_soon: false,
    status: "PREPARED",
    stock_deducted: false,
    deducted_at: null,
    prepared_by_email: null,
    prepared_at: null,
    checked_by_email: null,
    checked_at: null,
    created_at: "2026-06-20T09:00:00Z",
    updated_at: "2026-06-20T09:00:00Z",
    ...overrides,
  };
}

function reviewsAuth(canManage = true) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "review.view": true,
        "review.manage": canManage,
      },
    }),
  });
}

function renderSection(canManage = true) {
  return renderWithProviders(<PatientReviewsSection patientId={7} />, {
    auth: reviewsAuth(canManage),
  });
}

describe("PatientReviewsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getReviewsMock.mockResolvedValue([makeReview()]);
    listDosetteCyclesMock.mockResolvedValue([makeCycle()]);
  });

  it("renders patient reviews with pseudonymous identifiers", async () => {
    renderSection();

    expect(
      await screen.findByRole("heading", { name: "Reviews" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("SUT-P1")).toBeInTheDocument();
    expect(screen.getByText("Cycle MDS-2026-FW07")).toBeInTheDocument();
  });

  it("shows add and action buttons for manage users", async () => {
    renderSection();

    expect(
      await screen.findByRole("button", { name: "Add review" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("SUT-P1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("keeps view-only users read-only", async () => {
    renderSection(false);

    expect(await screen.findByText("SUT-P1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Complete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("renders empty loading and error states", async () => {
    getReviewsMock.mockReturnValueOnce(new Promise<Review[]>(() => undefined));
    const loadingRender = renderSection();
    expect(screen.getByText("Loading reviews...")).toBeInTheDocument();
    loadingRender.unmount();

    getReviewsMock.mockRejectedValueOnce(new Error("No reviews"));
    const errorRender = renderSection();
    expect(await screen.findByText("Could not load reviews.")).toBeInTheDocument();
    errorRender.unmount();

    getReviewsMock.mockResolvedValueOnce([]);
    renderSection();
    expect(
      await screen.findByText("No reviews for this patient."),
    ).toBeInTheDocument();
  });

  it("does not render patient PII or excluded wording", async () => {
    getReviewsMock.mockResolvedValueOnce([
      makeReview({
        notes: "Operational follow-up only.",
      }),
    ]);
    renderSection();

    expect(await screen.findByText("SUT-P1")).toBeInTheDocument();
    for (const forbidden of [
      "PatientOne",
      "PrivateLast",
      "date_of_birth",
      "address",
      "phone",
      "dose",
      "diagnosis",
      "recommendation",
      "clinical",
    ]) {
      expect(screen.queryByText(forbidden, { exact: false })).toBeNull();
    }
  });
});
