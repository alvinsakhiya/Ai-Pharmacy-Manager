import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NAV_ITEMS } from "../../app/navConfig";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { ReportsScreen } from "./ReportsScreen";
import type {
  ExpiryReport,
  ReportId,
  ReportPreview,
  ReportsDashboard,
  StockAttentionReport,
} from "./reportsApi";
import * as reportsApi from "./reportsApi";

vi.mock("./reportsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reportsApi")>();
  return {
    ...actual,
    getReportsDashboard: vi.fn(),
    getReportPreview: vi.fn(),
    downloadReportCsv: vi.fn(),
  };
});

const getReportsDashboardMock = vi.mocked(reportsApi.getReportsDashboard);
const getReportPreviewMock = vi.mocked(reportsApi.getReportPreview);
const downloadReportCsvMock = vi.mocked(reportsApi.downloadReportCsv);

function makeDashboard(): ReportsDashboard {
  return {
    report: "dashboard",
    generated_at: "2026-06-20T10:00:00Z",
    filters: {
      pharmacy_id: 7,
      group_id: 3,
    },
    cards: [
      {
        report: "stock_attention",
        title: "Stock attention",
        row_count: 1,
        available_exports: ["csv"],
        human_review_required: false,
      },
      {
        report: "expiry",
        title: "Expiry risk",
        row_count: 1,
        available_exports: ["csv"],
        human_review_required: false,
      },
      {
        report: "forecast_reorder",
        title: "Forecast & reorder",
        row_count: 1,
        available_exports: ["csv"],
        human_review_required: true,
      },
      {
        report: "transfer_suggestions",
        title: "Transfer suggestions",
        row_count: 1,
        available_exports: ["csv"],
        human_review_required: true,
      },
    ],
  };
}

function makeAttentionReport(
  overrides: Partial<StockAttentionReport> = {},
): StockAttentionReport {
  return {
    report: "stock_attention",
    generated_at: "2026-06-20T10:00:00Z",
    thresholds: {
      near_expiry_days: 90,
      dead_stock_days: 90,
      slow_moving_threshold: 5,
    },
    filters: {
      pharmacy_id: 7,
      flag: null,
      needs_attention: false,
    },
    summary: {
      total_items: 1,
      stockout: 0,
      low_stock: 1,
      near_expiry: 1,
      dead_stock: 0,
      slow_moving: 0,
      needs_attention: 1,
    },
    row_count: 1,
    rows: [
      {
        stock_item_id: 1,
        medication_id: 10,
        medication_name: "Paracetamol",
        pharmacy_id: 7,
        quantity_on_hand: 8,
        reorder_level: 20,
        earliest_expiry: "2026-07-01",
        days_to_expiry: 11,
        consumption_window: 12,
        flags: {
          stockout: false,
          low_stock: true,
          near_expiry: true,
          dead_stock: false,
          slow_moving: false,
        },
        attention_score: 40,
        suggested_reorder_quantity: 12,
        reasons: ["Low stock"],
      },
    ],
    ...overrides,
  };
}

function makeExpiryReport(): ExpiryReport {
  return {
    report: "expiry",
    generated_at: "2026-06-20T10:00:00Z",
    filters: {
      pharmacy_id: 7,
      window_days: 30,
    },
    row_count: 1,
    rows: [
      {
        pharmacy_id: 7,
        pharmacy_name: "Sutton Pharmacy",
        medication_label: "Paracetamol 500mg tablets",
        batch_number: "CRO-PAR-001",
        expiry_date: "2026-07-01",
        quantity: 24,
        days_until_expiry: 9,
        severity: "warning",
      },
    ],
  };
}

function reportFor(reportId: ReportId): ReportPreview {
  if (reportId === "expiry") {
    return makeExpiryReport();
  }
  return makeAttentionReport();
}

function reportsAuth(permissions: Record<string, boolean> = {}) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
        "forecast.view": true,
        "transfer_suggestion.view": true,
        "blister.view": true,
        ...permissions,
      },
      pharmacies: [{ id: 7, name: "Sutton Pharmacy" }],
      scope: {
        is_global: false,
        group_ids: [3],
        pharmacy_ids: [7],
      },
    }),
  });
}

function renderReports(permissions?: Record<string, boolean>) {
  return renderWithProviders(<ReportsScreen />, {
    auth: reportsAuth(permissions),
  });
}

describe("ReportsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getReportsDashboardMock.mockResolvedValue(makeDashboard());
    getReportPreviewMock.mockImplementation((reportId) =>
      Promise.resolve(reportFor(reportId)),
    );
    downloadReportCsvMock.mockResolvedValue(undefined);
  });

  it("renders the reports dashboard cards and header", async () => {
    renderReports();

    expect(
      await screen.findByRole("heading", { name: "Reports" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Operational exports and pharmacy intelligence reports."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stock attention/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Expiry risk/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Forecast & reorder/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Transfer suggestions/ }))
      .toBeInTheDocument();
  });

  it("selects a report and loads the preview table", async () => {
    const user = userEvent.setup();
    renderReports();

    await user.click(await screen.findByRole("button", { name: /Expiry risk/ }));

    expect(await screen.findByText("CRO-PAR-001")).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Expiry risk" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("warning")).toBeInTheDocument();
    expect(getReportPreviewMock).toHaveBeenCalledWith(
      "expiry",
      expect.objectContaining({ days: 30, pharmacyId: 7 }),
    );
  });

  it("downloads the selected report CSV with current filters", async () => {
    const user = userEvent.setup();
    renderReports();

    await user.click(await screen.findByRole("button", { name: /Expiry risk/ }));
    await screen.findByText("CRO-PAR-001");
    await user.click(screen.getByRole("button", { name: "Download CSV" }));

    await waitFor(() => {
      expect(downloadReportCsvMock).toHaveBeenCalledWith(
        "/api/reports/expiry.csv?pharmacy=7&days=30",
        "expiry-report.csv",
      );
    });
  });

  it("hides transfer suggestions for users without transfer permissions", async () => {
    renderReports({
      "transfer_suggestion.view": false,
    });

    expect(await screen.findByRole("button", { name: /Stock attention/ }))
      .toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Transfer suggestions/ }),
    ).toBeNull();
  });

  it("renders the preview loading state", () => {
    getReportPreviewMock.mockReturnValue(
      new Promise<ReportPreview>(() => undefined),
    );
    renderReports();

    expect(screen.getByText("Loading report preview...")).toBeInTheDocument();
  });

  it("renders the preview empty state", async () => {
    getReportPreviewMock.mockResolvedValue(
      makeAttentionReport({ row_count: 0, rows: [] }),
    );
    renderReports();

    expect(
      await screen.findByText("No rows to display for this report."),
    ).toBeInTheDocument();
  });

  it("renders the preview error state", async () => {
    getReportPreviewMock.mockRejectedValue(new Error("No report"));
    renderReports();

    expect(await screen.findByText("Could not load report preview."))
      .toBeInTheDocument();
  });

  it("keeps existing reports navigation available for stock view users", () => {
    expect(NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Reports",
          path: "/reports",
          requiredAnyOf: ["stock.view"],
        }),
      ]),
    );
  });

  it("does not render patient identifiers or unsafe report columns", async () => {
    renderReports();

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    const documentBody = within(document.body);
    for (const forbidden of [
      "patient_reference",
      "first_name",
      "last_name",
      "date_of_birth",
      "address",
      "phone",
      "dose_instructions",
      "diagnosis",
      "NHS",
      "clinically recommended",
      "automatic order",
      "automatic transfer",
    ]) {
      expect(documentBody.queryByText(forbidden)).toBeNull();
    }
  });
});
