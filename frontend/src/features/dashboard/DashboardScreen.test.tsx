import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { DashboardScreen } from "./DashboardScreen";
import type {
  WorkQueueItem,
  WorkQueueResponse,
  WorkQueueSummary,
} from "../notifications/notificationsApi";
import * as notificationsApi from "../notifications/notificationsApi";

vi.mock("../notifications/notificationsApi", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../notifications/notificationsApi")
  >();
  return {
    ...actual,
    getAlerts: vi.fn(),
    getWorkQueue: vi.fn(),
  };
});

const getWorkQueueMock = vi.mocked(notificationsApi.getWorkQueue);

function makeItem(overrides: Partial<WorkQueueItem> = {}): WorkQueueItem {
  return {
    id: "mds-due-soon-12",
    type: "MDS_DUE_SOON",
    group: "due_soon",
    priority: "high",
    title: "Prepare Dosette cycle",
    reason: "Suggested preparation window: due within 3 days.",
    pharmacy_id: 1,
    pharmacy_name: "Pharmacy One",
    patient_reference: "P1-WQ-001",
    cycle_id: 12,
    cycle_reference: "MDS-WQ-DUE-SOON",
    cycle_display_label: "P1-WQ-001 · 4-week supply · 28 Jun 2026 - 25 Jul 2026",
    cycle_start_date: "2026-06-28",
    cycle_end_date: "2026-07-25",
    due_date: "2026-06-28",
    status: "DUE_SOON",
    action_label: "Open Dosette",
    action_href: "/patients/4/dosette",
    ...overrides,
  };
}

function makeSummary(items: WorkQueueItem[]): WorkQueueSummary {
  return {
    total: items.length,
    urgent: items.filter((item) => item.group === "urgent").length,
    due_soon: items.filter((item) => item.group === "due_soon").length,
    waiting_check: items.filter((item) => item.group === "waiting_check").length,
    stock_action: items.filter((item) => item.group === "stock_action").length,
    reviews: items.filter((item) => item.group === "reviews").length,
  };
}

function queueItems(): WorkQueueItem[] {
  return [
    makeItem({
      id: "mds-overdue-11",
      type: "MDS_OVERDUE",
      group: "urgent",
      priority: "urgent",
      title: "Prepare Dosette cycle",
      reason: "Cycle date range has passed; human review required.",
      status: "OVERDUE",
      due_date: "2026-06-20",
    }),
    makeItem(),
    makeItem({
      id: "review-pending-3",
      type: "REVIEW_PENDING",
      group: "reviews",
      priority: "high",
      title: "Review pending",
      reason: "Pharmacist review pending.",
      patient_reference: "P1-WQ-001",
      cycle_id: null,
      cycle_reference: null,
      cycle_display_label: "",
      cycle_start_date: null,
      cycle_end_date: null,
      due_date: "2026-06-27",
      status: "PENDING",
      action_label: "Open reviews",
      action_href: "/reviews",
    }),
    makeItem({
      id: "stock-alert-stockout-7",
      type: "STOCK_STOCKOUT",
      group: "stock_action",
      priority: "urgent",
      title: "Stockout: Paracetamol",
      reason: "0 units on hand. Human review required.",
      pharmacy_id: 2,
      pharmacy_name: "Pharmacy Two",
      patient_reference: "",
      cycle_id: null,
      cycle_reference: "",
      cycle_display_label: "",
      cycle_start_date: null,
      cycle_end_date: null,
      due_date: null,
      status: "CRITICAL",
      action_label: "Open inventory",
      action_href: "/inventory/7",
    }),
  ];
}

function makeResponse(
  overrides: Partial<WorkQueueResponse> = {},
): WorkQueueResponse {
  const items = overrides.items ?? queueItems();
  return {
    generated_at: "2026-06-26T09:30:00Z",
    summary: makeSummary(items),
    items,
    ...overrides,
  };
}

function renderDashboard() {
  return renderWithProviders(<DashboardScreen />, {
    auth: makeAuthContext({
      user: makeAuthUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "review.view": true,
        },
      }),
    }),
  });
}

describe("DashboardScreen work queue widget", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getWorkQueueMock.mockResolvedValue(makeResponse());
  });

  it("shows the Needs attention widget with queue summary counts", async () => {
    renderDashboard();

    const widget = await screen.findByRole("region", { name: "Needs attention" });

    expect(within(widget).getByRole("heading", { name: "Needs attention" }))
      .toBeInTheDocument();
    expect(await within(widget).findByText(/Updated/)).toBeInTheDocument();
    expect(within(widget).getAllByText("Urgent").length).toBeGreaterThan(0);
    expect(within(widget).getAllByText("Due soon").length).toBeGreaterThan(0);
    expect(within(widget).getAllByText("Waiting check").length)
      .toBeGreaterThan(0);
    expect(within(widget).getAllByText("Stock action").length)
      .toBeGreaterThan(0);
    expect(within(widget).getAllByText("Reviews").length).toBeGreaterThan(0);
    expect(within(widget).getAllByText("1").length).toBeGreaterThanOrEqual(3);
  });

  it("shows top tasks with safe patient references and action links", async () => {
    renderDashboard();

    const widget = await screen.findByRole("region", { name: "Needs attention" });

    expect((await within(widget).findAllByText("Prepare Dosette cycle")).length)
      .toBeGreaterThan(0);
    expect(
      within(widget).getAllByText("Patient ID P1-WQ-001", { exact: false }).length,
    ).toBeGreaterThan(0);
    expect(within(widget).getAllByText("Pharmacy One", { exact: false }).length)
      .toBeGreaterThan(0);
    expect(within(widget).getByRole("link", { name: /Open Work Queue/ }))
      .toHaveAttribute("href", "/work-queue");
    expect(within(widget).getAllByRole("link", { name: /Open Dosette/ })[0])
      .toHaveAttribute("href", "/patients/4/dosette");
    expect(within(widget).getByRole("link", { name: /Open Pharmacist Reviews/ }))
      .toHaveAttribute("href", "/reviews");
    expect(within(widget).getByRole("link", { name: /Open Inventory/ }))
      .toHaveAttribute("href", "/inventory/7");
    for (const forbidden of [
      "Patient One",
      "first_name",
      "date_of_birth",
      "postcode",
      "phone",
      "Private review note",
    ]) {
      expect(within(widget).queryByText(forbidden)).toBeNull();
    }
  });

  it("shows the work queue empty state", async () => {
    getWorkQueueMock.mockResolvedValueOnce(makeResponse({ items: [] }));
    renderDashboard();

    const widget = await screen.findByRole("region", { name: "Needs attention" });

    expect(await within(widget).findByText("Nothing needs attention right now."))
      .toBeInTheDocument();
  });
});
