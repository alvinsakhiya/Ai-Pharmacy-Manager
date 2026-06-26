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
  DeadStockReport,
  ExpiryReport,
  ForecastReorderReport,
  MdsWorkloadReport,
  ReportId,
  ReportPreview,
  ReportsDashboard,
  StockAttentionReport,
  StockValuationReport,
  TransferSuggestionsReport,
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
      {
        report: "dead_stock",
        title: "Dead/slow stock",
        row_count: 1,
        available_exports: ["csv"],
        human_review_required: true,
      },
      {
        report: "mds_workload",
        title: "MDS workload",
        row_count: 1,
        available_exports: ["csv"],
        human_review_required: false,
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

function makeDeadStockReport(): DeadStockReport {
  return {
    report: "dead_stock",
    generated_at: "2026-06-20T10:00:00Z",
    filters: {
      pharmacy_id: 7,
      window_days: 90,
    },
    row_count: 1,
    rows: [
      {
        pharmacy_id: 7,
        medication_label: "Co-codamol 8/500 tablets",
        quantity_on_hand: 42,
        days_since_last_outbound: 120,
        status: "dead",
        suggested_action: "No recent outbound movement. Human review required before stock action.",
      },
    ],
  };
}

function makeForecastReport(): ForecastReorderReport {
  return {
    report: "forecast_reorder",
    generated_at: "2026-06-20T10:00:00Z",
    filters: {
      pharmacy_id: 7,
    },
    row_count: 1,
    rows: [
      {
        pharmacy_id: 7,
        pharmacy_name: "Sutton Pharmacy",
        medication_label: "Atorvastatin 20mg tablets",
        predicted_usage_units: 60,
        current_stock_units: 20,
        suggested_reorder_units: 40,
        suggested_reorder_packs: 2,
        confidence: "0.80",
        explanation_summary: "Recent movement suggests increased usage.",
        human_review_required: true,
        forecast_run_id: 5,
        forecast_created_at: "2026-06-20T09:00:00Z",
      },
    ],
  };
}

function makeTransferReport(): TransferSuggestionsReport {
  return {
    report: "transfer_suggestions",
    generated_at: "2026-06-20T10:00:00Z",
    filters: {
      group_id: 3,
      status: "OPEN",
    },
    row_count: 1,
    rows: [
      {
        group_id: 3,
        group_name: "South Group",
        source_pharmacy_id: 8,
        source_pharmacy_name: "Croydon Pharmacy",
        destination_pharmacy_id: 7,
        destination_pharmacy_name: "Sutton Pharmacy",
        medication_label: "Amlodipine 5mg tablets",
        suggested_quantity_units: 30,
        suggested_quantity_packs: 1,
        confidence: "0.70",
        status: "OPEN",
        reason: "One branch has surplus while another has stock pressure.",
        created_at: "2026-06-20T09:00:00Z",
        human_review_required: true,
      },
    ],
  };
}

function makeMdsWorkloadReport(): MdsWorkloadReport {
  return {
    report: "mds_workload",
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
        cycle_status: "PREPARED",
        due_count: 3,
        overdue_count: 1,
        upcoming_cycles: 4,
      },
    ],
  };
}

function makeValuationReport(): StockValuationReport {
  return {
    report: "stock_valuation",
    generated_at: "2026-06-20T10:00:00Z",
    filters: {
      pharmacy_id: 7,
    },
    summary: {
      total_units: 42,
      total_value: "21.00",
      priced_items: 1,
      unpriced_items: 0,
    },
    row_count: 1,
    rows: [
      {
        stock_item_id: 1,
        pharmacy_id: 7,
        pharmacy_name: "Sutton Pharmacy",
        medication_label: "Paracetamol 500mg tablets",
        quantity_on_hand: 42,
        unit_price: "0.50",
        pack_price: "16.00",
        stock_value: "21.00",
      },
    ],
  };
}

function reportFor(reportId: ReportId): ReportPreview {
  if (reportId === "expiry") {
    return makeExpiryReport();
  }
  if (reportId === "dead_stock") {
    return makeDeadStockReport();
  }
  if (reportId === "forecast_reorder") {
    return makeForecastReport();
  }
  if (reportId === "transfer_suggestions") {
    return makeTransferReport();
  }
  if (reportId === "mds_workload") {
    return makeMdsWorkloadReport();
  }
  if (reportId === "stock_valuation") {
    return makeValuationReport();
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
      screen.getByText(
        "Review stock, expiry, workload, and planning insights before taking action.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Expiring soon")).toBeInTheDocument();
    expect(screen.getByText("Dead stock lines")).toBeInTheDocument();
    expect(screen.getByText("Reorder suggestions")).toBeInTheDocument();
    expect(screen.getAllByText("Transfer suggestions").length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText("MDS workload").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Stock safety/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stock efficiency/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Forecasting & planning/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dosette workload/ }))
      .toBeInTheDocument();
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
    expect(screen.getByText("Expiry rows")).toBeInTheDocument();
    expect(screen.getAllByText("0-7 days").length).toBeGreaterThan(0);
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
    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => {
      expect(downloadReportCsvMock).toHaveBeenCalledWith(
        "/api/reports/expiry.csv?pharmacy=7&days=30",
        "expiry-report.csv",
      );
    });
    expect(
      screen.getByText("Expiry risk export. Exports reflect the current filtered report."),
    ).toBeInTheDocument();
  });

  it("uses safe wording for forecast reorder reports", async () => {
    const user = userEvent.setup();
    renderReports();

    await user.click(
      await screen.findByRole("button", { name: /Forecast & reorder/ }),
    );

    expect((await screen.findAllByText("Suggested reorder review")).length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText("Forecast estimate").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review before ordering.").length)
      .toBeGreaterThan(0);
    expect(screen.queryByText(/must order/i)).toBeNull();
    expect(screen.queryByText(/automatic order/i)).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /order now|create order|place order/i,
      }),
    ).toBeNull();
  });

  it("uses safe wording for transfer suggestions", async () => {
    const user = userEvent.setup();
    renderReports();

    await user.click(
      await screen.findByRole("button", { name: /Transfer suggestions/ }),
    );

    expect(await screen.findByText("Potential opportunity")).toBeInTheDocument();
    expect(screen.getAllByText("Potential transfer opportunity").length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText("Review before transfer.").length)
      .toBeGreaterThan(0);
    expect(screen.queryByText(/must transfer/i)).toBeNull();
    expect(screen.queryByText(/automatic transfer/i)).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /transfer now|create transfer|transfer stock/i,
      }),
    ).toBeNull();
  });

  it("renders MDS workload without patient PII", async () => {
    const user = userEvent.setup();
    renderReports();

    await user.click(await screen.findByRole("button", { name: /MDS workload/ }));

    expect(await screen.findByText("Workload rows")).toBeInTheDocument();
    expect(screen.getByText("PREPARED")).toBeInTheDocument();
    for (const forbidden of [
      "Patient One",
      "date_of_birth",
      "postcode",
      "phone",
      "email",
      "address",
      "NHS number",
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
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

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("renders the preview empty state", async () => {
    getReportPreviewMock.mockResolvedValue(
      makeAttentionReport({ row_count: 0, rows: [] }),
    );
    renderReports();

    expect(
      await screen.findByText("No report data available yet."),
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
