import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { WorkQueueScreen } from "./WorkQueueScreen";
import type {
  WorkQueueItem,
  WorkQueueResponse,
  WorkQueueSummary,
} from "./notificationsApi";
import * as notificationsApi from "./notificationsApi";

vi.mock("./notificationsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./notificationsApi")>();
  return {
    ...actual,
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
      cycle_id: 11,
      cycle_reference: "MDS-WQ-OVERDUE",
      cycle_start_date: "2026-05-25",
      cycle_end_date: "2026-06-20",
      due_date: "2026-06-20",
      status: "OVERDUE",
    }),
    makeItem(),
    makeItem({
      id: "mds-waiting-check-13",
      type: "MDS_WAITING_CHECK",
      group: "waiting_check",
      title: "Check prepared cycle",
      reason: "Prepared, awaiting pharmacist check.",
      cycle_id: 13,
      cycle_reference: "MDS-WQ-PREPARED",
      due_date: "2026-06-28",
      status: "WAITING_CHECK",
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
    makeItem({
      id: "review-pending-3",
      type: "REVIEW_PENDING",
      group: "reviews",
      priority: "high",
      title: "Review pending",
      reason: "Pharmacist review pending.",
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

function workQueueAuth() {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
        "blister.view": true,
        "review.view": true,
      },
    }),
  });
}

function renderWorkQueue() {
  return renderWithProviders(<WorkQueueScreen />, {
    auth: workQueueAuth(),
  });
}

describe("WorkQueueScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getWorkQueueMock.mockResolvedValue(makeResponse());
  });

  it("renders the operational header, summary cards, and grid groups", async () => {
    renderWorkQueue();

    expect(
      await screen.findByRole("heading", { name: "Work Queue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review pharmacy tasks that need attention before action."),
    ).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();
    expect(screen.getAllByText("All tasks").length).toBeGreaterThan(0);
    expect(await screen.findByText(/Generated/)).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "Work queue summary" });
    expect(within(summary).getByText("Due today")).toBeInTheDocument();
    expect(within(summary).getByText("Overdue")).toBeInTheDocument();
    expect(within(summary).getByText("Due soon")).toBeInTheDocument();
    expect(within(summary).getByText("MDS prep")).toBeInTheDocument();
    expect(within(summary).getByText("Stock review")).toBeInTheDocument();
    expect(within(summary).getByText("Expiry review")).toBeInTheDocument();
    expect(within(summary).getByText("5 open tasks in source view"))
      .toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "MDS preparation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Stock review" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.getAllByText("Prepare tray").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Check stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review before action").length).toBeGreaterThan(0);
  });

  it("shows safe patient references and existing-record action links", async () => {
    renderWorkQueue();

    expect((await screen.findAllByText("P1-WQ-001")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Patient ref").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Action type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cycle ref").length).toBeGreaterThan(0);
    expect(screen.getByText("MDS-WQ-DUE-SOON")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open Dosette/ })[0])
      .toHaveAttribute("href", "/patients/4/dosette");
    expect(screen.getByRole("link", { name: "Open record: Open Pharmacist Reviews" }))
      .toHaveAttribute("href", "/reviews");
    expect(screen.getByRole("link", { name: "Open record: Open Inventory" }))
      .toHaveAttribute("href", "/inventory/7");
    for (const forbidden of [
      "Patient One",
      "Date of birth",
      "DOB",
      "NHS number",
      "postcode",
      "first_name",
      "date_of_birth",
      "address",
      "phone",
      "Private review note",
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("filters by search, priority, task type, and pharmacy", async () => {
    const user = userEvent.setup();
    renderWorkQueue();

    expect(await screen.findByText("Stockout: Paracetamol")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search tasks"), "pending");
    expect(screen.getByText("Review pending")).toBeInTheDocument();
    expect(screen.queryByText("Stockout: Paracetamol")).toBeNull();
    expect(screen.getAllByText("1 active filter").length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText("Search tasks"));

    await user.selectOptions(screen.getByLabelText("Priority"), "high");
    expect(screen.getByText("Review pending")).toBeInTheDocument();
    expect(screen.queryByText("Stockout: Paracetamol")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Priority"), "all");
    await user.selectOptions(screen.getByLabelText("Task type"), "REVIEW_PENDING");
    expect(screen.getByText("Review pending")).toBeInTheDocument();
    expect(screen.queryByText("Stockout: Paracetamol")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Task type"), "all");
    await user.selectOptions(screen.getByLabelText("Pharmacy"), "2");
    expect(screen.getByText("Stockout: Paracetamol")).toBeInTheDocument();
    expect(screen.queryByText("Review pending")).toBeNull();
  });

  it("renders empty and error states", async () => {
    getWorkQueueMock.mockResolvedValueOnce(makeResponse({ items: [] }));
    const emptyRender = renderWorkQueue();

    expect(
      await screen.findByText("No tasks match the current view."),
    ).toBeInTheDocument();
    emptyRender.unmount();
    getWorkQueueMock.mockClear();

    getWorkQueueMock.mockRejectedValueOnce(new Error("No queue"));
    const user = userEvent.setup();
    renderWorkQueue();

    expect(await screen.findByText("Could not load work queue."))
      .toBeInTheDocument();
    getWorkQueueMock.mockResolvedValueOnce(makeResponse());
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(getWorkQueueMock).toHaveBeenCalledTimes(2);
    });
  });

  it("does not render mutation controls on the read-only queue", async () => {
    renderWorkQueue();

    expect(
      (await screen.findAllByText("Prepare Dosette cycle")).length,
    ).toBeGreaterThan(0);
    expect(getWorkQueueMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", {
        name: /prepare|check|deduct|complete|resolve|clear|dismiss|mark done|order now|transfer now|generate cycle|delete/i,
      }),
    ).toBeNull();
    const pageText = document.body.textContent ?? "";
    for (const forbidden of [
      "AI decided",
      "clinically recommended",
      "automatic ordering",
      "automatic transfer",
      "automatic cycle creation",
      "NHS integration",
      "NCRS",
      "compliance proof",
      "Complete task",
      "Mark done",
      "Order now",
      "Transfer now",
      "Generate cycle",
      "Delete",
    ]) {
      expect(pageText).not.toContain(forbidden);
    }
  });

  it("refreshes the queue without rendering task mutation controls", async () => {
    const user = userEvent.setup();
    renderWorkQueue();

    expect(
      (await screen.findAllByText("Prepare Dosette cycle")).length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(getWorkQueueMock).toHaveBeenCalledTimes(2);
    });
    expect(
      screen.queryByRole("button", {
        name: /prepare|check|deduct|complete|resolve|clear|dismiss|mark done|order now|transfer now|generate cycle|delete/i,
      }),
    ).toBeNull();
  });

  it("renders stock-only data without patient fields", async () => {
    getWorkQueueMock.mockResolvedValueOnce(
      makeResponse({
        items: [
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
        ],
      }),
    );

    renderWorkQueue();

    expect(await screen.findByText("Stockout: Paracetamol")).toBeInTheDocument();
    expect(screen.getByText("Pharmacy Two")).toBeInTheDocument();
    expect(screen.queryByText("Patient ref")).toBeNull();
    expect(screen.queryByText("P1-WQ-001")).toBeNull();
    expect(
      screen.getByText("MDS reminders will appear here when available."),
    ).toBeInTheDocument();
  });
});
