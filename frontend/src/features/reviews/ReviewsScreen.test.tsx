import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NAV_ITEMS } from "../../app/navConfig";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { Patient } from "../patients/patientApi";
import * as patientApi from "../patients/patientApi";
import { ReviewsScreen } from "./ReviewsScreen";
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

vi.mock("../patients/patientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../patients/patientApi")>();
  return {
    ...actual,
    listPatients: vi.fn(),
  };
});

const cancelReviewMock = vi.mocked(reviewsApi.cancelReview);
const completeReviewMock = vi.mocked(reviewsApi.completeReview);
const createReviewMock = vi.mocked(reviewsApi.createReview);
const getReviewsMock = vi.mocked(reviewsApi.getReviews);
const listPatientsMock = vi.mocked(patientApi.listPatients);

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 12,
    patient: 7,
    patient_reference: "SUT-P1",
    dosette_cycle: 21,
    cycle_reference: "MDS-2026-FW07",
    status: "PENDING",
    priority: "ATTENTION",
    assigned_to: 3,
    assigned_to_email: "pharmacist@example.com",
    due_date: "2026-07-15",
    completed_at: null,
    is_overdue: true,
    notes: "Check supply timing before next collection.",
    created_at: "2026-06-20T09:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
    ...overrides,
  };
}

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 7,
    pharmacy: 1,
    patient_reference: "SUT-P1",
    first_name: "PatientOne",
    last_name: "PrivateLast",
    date_of_birth: "1980-01-01",
    address: "1 Private Street",
    postcode: "TE1 1ST",
    phone: "020 0000 0000",
    notes: "Private patient note",
    is_active: true,
    created_at: "2026-06-20T09:00:00Z",
    updated_at: "2026-06-20T09:00:00Z",
    ...overrides,
  };
}

function dateOnlyInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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

function renderReviews(canManage = true) {
  return renderWithProviders(<ReviewsScreen />, {
    auth: reviewsAuth(canManage),
  });
}

describe("ReviewsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getReviewsMock.mockResolvedValue([
      makeReview(),
      makeReview({
        id: 13,
        patient_reference: "CRO-P1",
        dosette_cycle: null,
        cycle_reference: null,
        status: "COMPLETED",
        priority: "ROUTINE",
        is_overdue: false,
        assigned_to: null,
        assigned_to_email: null,
        completed_at: "2026-06-21T10:00:00Z",
        notes: "",
      }),
    ]);
    listPatientsMock.mockResolvedValue([makePatient()]);
    createReviewMock.mockResolvedValue(makeReview({ id: 30 }));
    completeReviewMock.mockResolvedValue(
      makeReview({ status: "COMPLETED", completed_at: "2026-06-21T10:00:00Z" }),
    );
    cancelReviewMock.mockResolvedValue(makeReview({ status: "CANCELLED" }));
  });

  it("renders the queue and review card details", async () => {
    renderReviews();

    expect(
      await screen.findByRole("heading", {
        name: "Reviews",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review pending pharmacy decisions before action."),
    ).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();
    expect(screen.getAllByText("All reviews").length).toBeGreaterThan(0);

    const summary = await screen.findByRole("region", {
      name: "Reviews summary",
    });
    expect(within(summary).getByText("Open reviews")).toBeInTheDocument();
    expect(within(summary).getByText("Due soon")).toBeInTheDocument();
    expect(within(summary).getByText("Overdue")).toBeInTheDocument();
    expect(within(summary).getByText("Completed")).toBeInTheDocument();
    expect(within(summary).getByText("Needs attention")).toBeInTheDocument();
    expect(within(summary).getByText("2 reviews in source view"))
      .toBeInTheDocument();

    expect(screen.getByRole("region", { name: "Grouped review queue" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs attention" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Completed" }))
      .toBeInTheDocument();
    expect(screen.getByText("Review for SUT-P1")).toBeInTheDocument();
    expect(screen.getByText("Dosette review")).toBeInTheDocument();
    expect(screen.getByText("General review")).toBeInTheDocument();
    expect(screen.getByText("Cycle MDS-2026-FW07")).toBeInTheDocument();
    expect(
      screen.getByText("Check supply timing before next collection."),
    ).toBeInTheDocument();
    expect(screen.getByText("pharmacist@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Created").length).toBeGreaterThan(0);
  });

  it("groups reviews without hiding or duplicating cards", async () => {
    getReviewsMock.mockResolvedValue([
      makeReview({
        id: 12,
        patient_reference: "ATTN-P1",
        status: "PENDING",
        priority: "ATTENTION",
        is_overdue: true,
        due_date: dateOnlyInDays(-1),
      }),
      makeReview({
        id: 13,
        patient_reference: "DUE-P1",
        status: "PENDING",
        priority: "ROUTINE",
        is_overdue: false,
        due_date: dateOnlyInDays(3),
      }),
      makeReview({
        id: 14,
        patient_reference: "OPEN-P1",
        status: "IN_REVIEW",
        priority: "ROUTINE",
        is_overdue: false,
        due_date: dateOnlyInDays(21),
      }),
      makeReview({
        id: 15,
        patient_reference: "DONE-P1",
        status: "COMPLETED",
        priority: "ROUTINE",
        is_overdue: false,
        due_date: dateOnlyInDays(1),
      }),
      makeReview({
        id: 16,
        patient_reference: "CANCEL-P1",
        status: "CANCELLED",
        priority: "ROUTINE",
        is_overdue: false,
        due_date: null,
      }),
    ]);

    renderReviews();

    for (const group of [
      "Needs attention",
      "Due soon",
      "Open reviews",
      "Completed",
      "Earlier / archived",
    ]) {
      expect(await screen.findByRole("heading", { name: group }))
        .toBeInTheDocument();
    }

    for (const reference of [
      "ATTN-P1",
      "DUE-P1",
      "OPEN-P1",
      "DONE-P1",
      "CANCEL-P1",
    ]) {
      expect(screen.getAllByText(`Review for ${reference}`)).toHaveLength(1);
    }
  });

  it("renders status priority and overdue badges", async () => {
    renderReviews();

    expect(await screen.findByText("Review for SUT-P1")).toBeInTheDocument();
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Attention").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Routine").length).toBeGreaterThan(0);
  });

  it("shows create and active review actions for manage users", async () => {
    renderReviews();

    expect(
      await screen.findByRole("button", { name: "New review" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Review for SUT-P1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("preserves API filters and applies local search to existing review data", async () => {
    const user = userEvent.setup();
    renderReviews();

    expect(await screen.findByText("Review for SUT-P1")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search reviews"), "CRO");
    expect(screen.getByText("Review matches")).toBeInTheDocument();
    expect(screen.getAllByText("Review for CRO-P1").length).toBeGreaterThan(0);
    expect(screen.queryByText("Review for SUT-P1")).toBeNull();
    expect(screen.getAllByText("1 active filter").length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText("Search reviews"));

    await user.selectOptions(screen.getByLabelText("Status"), "COMPLETED");
    await waitFor(() => {
      expect(getReviewsMock).toHaveBeenLastCalledWith({
        status: "COMPLETED",
      });
    });

    await user.selectOptions(screen.getByLabelText("Priority"), "URGENT");
    await waitFor(() => {
      expect(getReviewsMock).toHaveBeenLastCalledWith({
        status: "COMPLETED",
        priority: "URGENT",
      });
    });

    await user.click(screen.getByLabelText("Overdue only"));
    await waitFor(() => {
      expect(getReviewsMock).toHaveBeenLastCalledWith({
        status: "COMPLETED",
        priority: "URGENT",
        overdue: true,
      });
    });
  });

  it("keeps view-only users read-only", async () => {
    renderReviews(false);

    expect(await screen.findByText("Review for SUT-P1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Complete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("renders loading error and empty states", async () => {
    getReviewsMock.mockReturnValueOnce(new Promise<Review[]>(() => undefined));
    const loadingRender = renderReviews();
    expect(screen.getByText("Loading review queue...")).toBeInTheDocument();
    loadingRender.unmount();
    getReviewsMock.mockClear();

    getReviewsMock.mockRejectedValueOnce(new Error("No reviews"));
    const user = userEvent.setup();
    const errorRender = renderReviews();
    expect(await screen.findByText("Could not load reviews.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(getReviewsMock).toHaveBeenCalledTimes(2);
    });
    errorRender.unmount();

    getReviewsMock.mockResolvedValueOnce([]);
    renderReviews();
    expect(
      await screen.findByText("No reviews match the current view."),
    ).toBeInTheDocument();
  });

  it("creates reviews without client-controlled status fields", async () => {
    const user = userEvent.setup();
    renderReviews();

    await user.click(await screen.findByRole("button", { name: "New review" }));
    const dialog = screen.getByRole("dialog", { name: "New review" });
    await user.selectOptions(within(dialog).getByLabelText("Patient"), "7");
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "URGENT");
    await user.type(within(dialog).getByLabelText("Due date"), "2026-07-20");
    await user.type(within(dialog).getByLabelText("Notes"), "Follow up next run.");
    await user.click(within(dialog).getByRole("button", { name: "Create review" }));

    await waitFor(() => {
      expect(createReviewMock).toHaveBeenCalledWith({
        patient: 7,
        priority: "URGENT",
        due_date: "2026-07-20",
        notes: "Follow up next run.",
      });
    });
    const payload = createReviewMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBeUndefined();
    expect(payload.completed_at).toBeUndefined();
  });

  it("completes and cancels reviews through confirmations", async () => {
    const user = userEvent.setup();
    renderReviews();

    await user.click(await screen.findByRole("button", { name: "Complete" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Complete review?" }))
        .getByRole("button", { name: "Complete" }),
    );
    await waitFor(() => {
      expect(completeReviewMock).toHaveBeenCalledWith(12);
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Cancel review?" }))
        .getByRole("button", { name: "Cancel review" }),
    );
    await waitFor(() => {
      expect(cancelReviewMock).toHaveBeenCalledWith(12);
    });
  });

  it("gates the nav item with review.view", () => {
    expect(NAV_ITEMS).toContainEqual(
      expect.objectContaining({
        label: "Pharmacist Reviews",
        path: "/reviews",
        requiredAnyOf: ["review.view"],
      }),
    );
  });

  it("does not render patient PII or excluded wording in the review queue", async () => {
    renderReviews();

    expect(await screen.findByText("Review for SUT-P1")).toBeInTheDocument();
    for (const forbidden of [
      "PatientOne",
      "PrivateLast",
      "date_of_birth",
      "DOB",
      "NHS number",
      "postcode",
      "1 Private Street",
      "020 0000 0000",
      "diagnosis",
      "recommendation",
      "clinical",
      "AI decided",
      "automatic approval",
      "automatic rejection",
      "automatic ordering",
      "automatic transfer",
      "automatic cycle creation",
      "NHS integration",
      "NCRS",
      "compliance proof",
      "Auto approve",
      "Auto reject",
      "Order now",
      "Transfer now",
      "Generate cycle",
      "Delete",
    ]) {
      expect(screen.queryByText(forbidden, { exact: false })).toBeNull();
    }
  });
});
