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
  StockAttentionReport,
  StockMovementsReport,
} from "./reportsApi";
import * as reportsApi from "./reportsApi";

vi.mock("./reportsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reportsApi")>();
  return {
    ...actual,
    getStockAttentionReport: vi.fn(),
    getStockMovementsReport: vi.fn(),
    downloadReportCsv: vi.fn(),
  };
});

const getStockAttentionReportMock = vi.mocked(
  reportsApi.getStockAttentionReport,
);
const getStockMovementsReportMock = vi.mocked(
  reportsApi.getStockMovementsReport,
);
const downloadReportCsvMock = vi.mocked(reportsApi.downloadReportCsv);

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
      pharmacy_id: null,
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
        reasons: [
          "Low stock: 8 on hand at or below reorder level 20",
          "Near expiry: earliest batch expires in 11 days",
        ],
      },
    ],
    ...overrides,
  };
}

function makeMovementsReport(
  overrides: Partial<StockMovementsReport> = {},
): StockMovementsReport {
  return {
    report: "stock_movements",
    generated_at: "2026-06-20T10:00:00Z",
    filters: {
      pharmacy_id: null,
      medication_id: null,
      stock_item_id: null,
      movement_type: null,
      date_from: null,
      date_to: null,
      limit: 500,
    },
    row_count: 1,
    limited: true,
    rows: [
      {
        movement_id: 21,
        created_at: "2026-06-20T09:30:00Z",
        stock_item_id: 1,
        medication_id: 10,
        medication_name: "Ibuprofen",
        pharmacy_id: 8,
        batch_id: 5,
        batch_number: "CRO-IBU-001",
        movement_type: "RECEIPT",
        quantity_delta: 100,
        balance_after: 100,
        reference: "receipt-001",
      },
    ],
    ...overrides,
  };
}

function reportsAuth() {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
      },
    }),
  });
}

function renderReports() {
  return renderWithProviders(<ReportsScreen />, {
    auth: reportsAuth(),
  });
}

describe("ReportsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getStockAttentionReportMock.mockResolvedValue(makeAttentionReport());
    getStockMovementsReportMock.mockResolvedValue(makeMovementsReport());
    downloadReportCsvMock.mockResolvedValue(undefined);
  });

  it("renders the page header", async () => {
    renderReports();

    expect(
      await screen.findByRole("heading", { name: "Reports" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Read-only stock reports and CSV exports."),
    ).toBeInTheDocument();
  });

  it("renders the stock attention report section", async () => {
    renderReports();

    expect(
      await screen.findByRole("heading", { name: "Stock attention report" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Total items")).toBeInTheDocument();
    expect(screen.getByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Download CSV" })).toHaveLength(
      2,
    );
  });

  it("renders the stock movements report section", async () => {
    renderReports();

    expect(
      await screen.findByRole("heading", { name: "Stock movements report" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Ibuprofen")).toBeInTheDocument();
    expect(screen.getByText("CRO-IBU-001")).toBeInTheDocument();
    expect(screen.getByText("Showing the most recent 500 movements."))
      .toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Download CSV" })).toHaveLength(
      2,
    );
  });

  it("downloads stock attention and movement CSV files through the API helper", async () => {
    const user = userEvent.setup();
    renderReports();

    await screen.findByText("Paracetamol");
    const buttons = screen.getAllByRole("button", { name: "Download CSV" });

    await user.click(buttons[0]);
    await waitFor(() => {
      expect(downloadReportCsvMock).toHaveBeenCalledWith(
        reportsApi.STOCK_ATTENTION_CSV_PATH,
        "stock-attention-report.csv",
      );
    });

    await user.click(buttons[1]);
    await waitFor(() => {
      expect(downloadReportCsvMock).toHaveBeenCalledWith(
        reportsApi.STOCK_MOVEMENTS_CSV_PATH,
        "stock-movements-report.csv",
      );
    });
  });

  it("renders independent loading states", () => {
    getStockAttentionReportMock.mockReturnValue(
      new Promise<StockAttentionReport>(() => undefined),
    );
    getStockMovementsReportMock.mockReturnValue(
      new Promise<StockMovementsReport>(() => undefined),
    );

    renderReports();

    expect(
      screen.getByText("Loading stock attention report..."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Loading stock movements report..."),
    ).toBeInTheDocument();
  });

  it("renders independent error states", async () => {
    getStockAttentionReportMock.mockRejectedValue(new Error("No attention"));
    getStockMovementsReportMock.mockRejectedValue(new Error("No movements"));

    renderReports();

    expect(
      await screen.findByText("Could not load stock attention report."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Could not load stock movements report."),
    ).toBeInTheDocument();
  });

  it("renders empty states", async () => {
    getStockAttentionReportMock.mockResolvedValue(
      makeAttentionReport({
        row_count: 0,
        rows: [],
        summary: {
          total_items: 0,
          stockout: 0,
          low_stock: 0,
          near_expiry: 0,
          dead_stock: 0,
          slow_moving: 0,
          needs_attention: 0,
        },
      }),
    );
    getStockMovementsReportMock.mockResolvedValue(
      makeMovementsReport({
        row_count: 0,
        limited: false,
        rows: [],
      }),
    );

    renderReports();

    expect(
      await screen.findByText("No stock attention rows to display."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No stock movements to display."),
    ).toBeInTheDocument();
  });

  it("adds reports to navigation for stock view users", () => {
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

  it("does not render patient staff or free-text stock movement fields", async () => {
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
      "note",
      "reason",
      "actor",
      "actor_id",
      "actor_email",
    ]) {
      expect(documentBody.queryByText(forbidden)).toBeNull();
      expect(
        screen
          .queryAllByRole("columnheader")
          .some((header) => header.textContent === forbidden),
      ).toBe(false);
    }
  });
});
