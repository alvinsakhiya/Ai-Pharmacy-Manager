import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { DashboardScreen } from "./DashboardScreen";
import type {
  AlertsResponse,
  WorkQueueItem,
  WorkQueueResponse,
  WorkQueueSummary,
} from "../notifications/notificationsApi";
import * as notificationsApi from "../notifications/notificationsApi";
import type {
  ExpiryReport,
  MdsWorkloadReport,
  ReportId,
  StockValuationReport,
} from "../reports/reportsApi";
import * as reportsApi from "../reports/reportsApi";

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

vi.mock("../reports/reportsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../reports/reportsApi")>();
  return {
    ...actual,
    getReportPreview: vi.fn(),
  };
});

const getAlertsMock = vi.mocked(notificationsApi.getAlerts);
const getWorkQueueMock = vi.mocked(notificationsApi.getWorkQueue);
const getReportPreviewMock = vi.mocked(reportsApi.getReportPreview);

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

function makeAlerts(): AlertsResponse {
  return {
    generated_at: "2026-06-26T09:30:00Z",
    summary: {
      total: 2,
      critical: 0,
      warning: 1,
      info: 1,
      by_category: {
        stock: 1,
        dosette: 1,
      },
    },
    alerts: [],
  };
}

function makeStockValuation(): StockValuationReport {
  return {
    report: "stock_valuation",
    generated_at: "2026-06-26T09:30:00Z",
    filters: { pharmacy_id: 1 },
    summary: {
      total_units: 24138,
      total_value: "739",
      priced_items: 2,
      unpriced_items: 0,
    },
    row_count: 2,
    rows: [],
  };
}

function makeExpiry(): ExpiryReport {
  return {
    report: "expiry",
    generated_at: "2026-06-26T09:30:00Z",
    filters: { pharmacy_id: 1, window_days: 30 },
    row_count: 2,
    rows: [
      {
        pharmacy_id: 1,
        pharmacy_name: "Pharmacy One",
        medication_label: "Paracetamol 500mg tablets",
        batch_number: "B-123",
        expiry_date: "2026-06-29",
        quantity: 12,
        days_until_expiry: 2,
        severity: "WARNING",
      },
      {
        pharmacy_id: 1,
        pharmacy_name: "Pharmacy One",
        medication_label: "Ibuprofen 200mg tablets",
        batch_number: "B-456",
        expiry_date: "2026-07-15",
        quantity: 6,
        days_until_expiry: 18,
        severity: "WARNING",
      },
    ],
  };
}

function makeMdsWorkload(): MdsWorkloadReport {
  return {
    report: "mds_workload",
    generated_at: "2026-06-26T09:30:00Z",
    filters: { pharmacy_id: 1, window_days: 30 },
    row_count: 1,
    rows: [
      {
        pharmacy_id: 1,
        pharmacy_name: "Pharmacy One",
        cycle_status: "DRAFT",
        due_count: 3,
        overdue_count: 0,
        upcoming_cycles: 2,
      },
    ],
  };
}

function mockReportPreview() {
  getReportPreviewMock.mockImplementation((reportId: ReportId) => {
    if (reportId === "stock_valuation") {
      return Promise.resolve(makeStockValuation());
    }
    if (reportId === "expiry") {
      return Promise.resolve(makeExpiry());
    }
    if (reportId === "mds_workload") {
      return Promise.resolve(makeMdsWorkload());
    }
    throw new Error(`Unexpected report ${reportId}`);
  });
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-27T12:00:00Z"));
    getAlertsMock.mockResolvedValue(makeAlerts());
    getWorkQueueMock.mockResolvedValue(makeResponse());
    mockReportPreview();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("renders the polished command-centre header and KPI cards from existing data", async () => {
    renderWithProviders(<DashboardScreen />, {
      auth: makeAuthContext({
        user: makeAuthUser({
          role: "PHARMACIST",
          scope: {
            is_global: false,
            group_ids: [],
            pharmacy_ids: [1],
          },
          pharmacies: [{ id: 1, name: "Pharmacy One" }],
          permissions: {
            "stock.view": true,
            "blister.view": true,
            "review.view": true,
          },
        }),
      }),
    });

    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "A daily summary of what needs your attention across stock, dosette packs, and workload.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Pharmacy One")).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();
    expect(screen.getAllByText("Saturday, 27 June 2026").length)
      .toBeGreaterThan(0);

    expect(await screen.findByText("Open alerts")).toBeInTheDocument();
    expect(screen.getByText("Stock value")).toBeInTheDocument();
    expect(screen.getByText("Current priced inventory value"))
      .toBeInTheDocument();
    expect(screen.getByText("Expiring ≤ 30d")).toBeInTheDocument();
    expect(screen.getByText("Packs due")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("£739")).toBeInTheDocument();
    });
    expect(screen.getByText("1 warning")).toBeInTheDocument();
    expect(screen.getByText("24,138 units")).toBeInTheDocument();
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

  it("does not render dashboard mutation controls or unsafe wording", async () => {
    renderDashboard();

    await screen.findByRole("region", { name: "Needs attention" });
    const pageText = document.body.textContent ?? "";

    for (const forbidden of [
      "AI decided",
      "must order",
      "automatic ordering",
      "automatic transfer",
      "automatic cycle creation",
      "NCRS",
      "NHS integration",
      "Complete task",
      "Transfer now",
      "Order now",
    ]) {
      expect(pageText).not.toContain(forbidden);
    }
  });

  it("shows the work queue empty state", async () => {
    getWorkQueueMock.mockResolvedValueOnce(makeResponse({ items: [] }));
    renderDashboard();

    const widget = await screen.findByRole("region", { name: "Needs attention" });

    expect(await within(widget).findByText("Nothing needs attention right now."))
      .toBeInTheDocument();
  });

  it("renders an interactive pharmacy calendar with month controls", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDashboard();

    const calendar = await screen.findByRole("region", {
      name: "Pharmacy calendar",
    });

    expect(within(calendar).getByText("Scheduled signals")).toBeInTheDocument();
    expect(within(calendar).getByRole("heading", { name: "June 2026" }))
      .toBeInTheDocument();
    expect(
      await within(calendar).findByRole("button", {
        name: "Select 27 June 2026, 1 scheduled signal",
      }),
    ).toBeInTheDocument();
    expect(
      await within(calendar).findByRole("button", {
        name: "Select 28 June 2026, 1 scheduled signal",
      }),
    ).toBeInTheDocument();

    await user.click(
      within(calendar).getByRole("button", { name: "Next month" }),
    );
    expect(within(calendar).getByRole("heading", { name: "July 2026" }))
      .toBeInTheDocument();

    await user.click(
      within(calendar).getByRole("button", { name: "Previous month" }),
    );
    expect(within(calendar).getByRole("heading", { name: "June 2026" }))
      .toBeInTheDocument();

    await user.click(
      within(calendar).getByRole("button", { name: "Previous month" }),
    );
    expect(within(calendar).getByRole("heading", { name: "May 2026" }))
      .toBeInTheDocument();

    await user.click(within(calendar).getByRole("button", { name: "Today" }));
    expect(within(calendar).getByRole("heading", { name: "June 2026" }))
      .toBeInTheDocument();
  });

  it("opens safe day details and action links from calendar day clicks", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDashboard();

    const calendar = await screen.findByRole("region", {
      name: "Pharmacy calendar",
    });

    await user.click(
      await within(calendar).findByRole("button", {
        name: "Select 28 June 2026, 1 scheduled signal",
      }),
    );

    const details = within(calendar).getByLabelText("Calendar day details");
    expect(
      within(details).getByRole("heading", {
        name: "Sunday, 28 June 2026",
      }),
    ).toBeInTheDocument();
    expect(within(details).getByText("Prepare Dosette cycle"))
      .toBeInTheDocument();
    expect(
      within(details).getByText(
        "Suggested preparation window: due within 3 days.",
      ),
    ).toBeInTheDocument();
    expect(within(details).getByText("Due soon")).toBeInTheDocument();
    expect(
      within(details).getByText("Dosette · Patient ID P1-WQ-001 · Pharmacy One"),
    ).toBeInTheDocument();
    expect(within(details).getByRole("link", { name: /Open Dosette/ }))
      .toHaveAttribute("href", "/patients/4/dosette");

    for (const forbidden of [
      "Patient One",
      "date_of_birth",
      "postcode",
      "phone",
      "email",
      "address",
      "NHS",
      "Complete task",
    ]) {
      expect(within(details).queryByText(forbidden)).toBeNull();
    }
  });

  it("shows an empty day state for calendar days without scheduled signals", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDashboard();

    const calendar = await screen.findByRole("region", {
      name: "Pharmacy calendar",
    });

    await user.click(
      within(calendar).getByRole("button", {
        name: "Select 26 June 2026, 0 scheduled signals",
      }),
    );

    const details = within(calendar).getByLabelText("Calendar day details");
    expect(within(details).getByText("No items scheduled for this day."))
      .toBeInTheDocument();
  });
});
