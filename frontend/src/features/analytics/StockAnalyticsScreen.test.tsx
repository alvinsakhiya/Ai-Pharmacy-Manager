import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NAV_ITEMS } from "../../app/navConfig";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type {
  ExpiryRisk,
  ForecastRun,
  MdsDemandSignal,
  StockReviewQueue,
  TransferSuggestion,
} from "./analyticsApi";
import * as analyticsApi from "./analyticsApi";
import { StockAnalyticsScreen } from "./StockAnalyticsScreen";

vi.mock("./analyticsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./analyticsApi")>();
  return {
    ...actual,
    dismissTransferSuggestion: vi.fn(),
    generateForecast: vi.fn(),
    generateTransferSuggestions: vi.fn(),
    getExpiryRisk: vi.fn(),
    getLatestForecast: vi.fn(),
    getMdsDemandSignal: vi.fn(),
    getStockAnalyticsOverview: vi.fn(),
    getStockReviewQueue: vi.fn(),
    listTransferSuggestions: vi.fn(),
  };
});

const dismissTransferSuggestionMock = vi.mocked(
  analyticsApi.dismissTransferSuggestion,
);
const generateForecastMock = vi.mocked(analyticsApi.generateForecast);
const generateTransferSuggestionsMock = vi.mocked(
  analyticsApi.generateTransferSuggestions,
);
const getExpiryRiskMock = vi.mocked(analyticsApi.getExpiryRisk);
const getLatestForecastMock = vi.mocked(analyticsApi.getLatestForecast);
const getMdsDemandSignalMock = vi.mocked(analyticsApi.getMdsDemandSignal);
const getStockReviewQueueMock = vi.mocked(analyticsApi.getStockReviewQueue);
const listTransferSuggestionsMock = vi.mocked(
  analyticsApi.listTransferSuggestions,
);

function makeMdsDemand(
  overrides: Partial<MdsDemandSignal> = {},
): MdsDemandSignal {
  return {
    generated_at: "2026-06-20T10:00:00Z",
    horizon_days: 28,
    summary: {
      total_required_units: 112,
      total_available_units: 72,
      total_shortfall_units: 40,
      items_with_shortfall: 1,
      mapping_needed: 0,
      cycles_affected: 4,
      patients_affected: 3,
    },
    items: [
      {
        stock_item_id: 1,
        medication_id: 10,
        medication_name: "Amlodipine",
        pharmacy_id: 7,
        pharmacy_name: "JMW Sutton",
        required_units: 112,
        available_units: 72,
        shortfall_units: 40,
        cycles_affected: 4,
        patients_affected: 3,
        mapping_status: "mapped",
        review_message: "Review before action.",
      },
    ],
    ...overrides,
  };
}

function makeExpiryRisk(overrides: Partial<ExpiryRisk> = {}): ExpiryRisk {
  return {
    generated_at: "2026-06-20T10:00:00Z",
    summary: {
      expiring_within_30_days_units: 14,
      value_at_risk: "28.00",
      unpriced_risk_units: 5,
      products_affected: 2,
    },
    buckets: [
      {
        key: "expired",
        label: "Expired",
        units: 2,
        estimated_value: "4.00",
        unpriced_units: 0,
        batch_count: 1,
        product_count: 1,
      },
      {
        key: "d0_7",
        label: "0-7 days",
        units: 8,
        estimated_value: "14.00",
        unpriced_units: 5,
        batch_count: 2,
        product_count: 2,
      },
      {
        key: "d8_30",
        label: "8-30 days",
        units: 4,
        estimated_value: "10.00",
        unpriced_units: 0,
        batch_count: 1,
        product_count: 1,
      },
      {
        key: "d31_60",
        label: "31-60 days",
        units: 6,
        estimated_value: "12.00",
        unpriced_units: 0,
        batch_count: 1,
        product_count: 1,
      },
      {
        key: "d61_90",
        label: "61-90 days",
        units: 0,
        estimated_value: "0.00",
        unpriced_units: 0,
        batch_count: 0,
        product_count: 0,
      },
      {
        key: "d90_plus",
        label: "90+ days",
        units: 30,
        estimated_value: "60.00",
        unpriced_units: 0,
        batch_count: 1,
        product_count: 1,
      },
    ],
    items: [
      {
        stock_item_id: 2,
        medication_id: 11,
        medication_name: "Bisoprolol",
        pharmacy_id: 8,
        pharmacy_name: "JMW Sutton",
        batch_number: "BIS-001",
        expiry_date: "2026-07-01",
        days_to_expiry: 11,
        quantity: 4,
        bucket: "d8_30",
        bucket_label: "8-30 days",
        estimated_value: "10.00",
        unpriced_units: 0,
        review_message: "Expiry risk. Review before action.",
      },
    ],
    ...overrides,
  };
}

function makeReviewQueue(
  overrides: Partial<StockReviewQueue> = {},
): StockReviewQueue {
  return {
    generated_at: "2026-06-20T10:00:00Z",
    horizon_days: 28,
    summary: {
      total_items: 1,
      high_risk: 1,
      medium_risk: 0,
      low_risk: 0,
      mds_shortfall: 1,
      expiry_risk: 1,
      low_confidence: 1,
    },
    items: [
      {
        stock_item_id: 1,
        medication_id: 10,
        medication_name: "Amlodipine",
        pharmacy_id: 7,
        pharmacy_name: "JMW Sutton",
        score: 100,
        risk_level: "high",
        reason_chips: [
          "MDS shortfall",
          "Low stock",
          "Expiry risk",
          "Low confidence",
          "Order review",
        ],
        signals: ["MDS demand signal", "Stock risk", "Expiry risk"],
        required_units: 112,
        available_units: 72,
        shortfall_units: 40,
        forecast_confidence: "0.35",
        forecast_confidence_label: "Low confidence",
        review_message: "Review before action. Human review required.",
      },
    ],
    ...overrides,
  };
}

function makeForecast(overrides: Partial<ForecastRun> = {}): ForecastRun {
  return {
    id: 30,
    pharmacy: 1,
    group: 1,
    horizon_days: 30,
    lookback_days: 90,
    model_version: "baseline-1",
    is_demo: false,
    generated_by: 10,
    status: "COMPLETED",
    created_at: "2026-06-20T10:00:00Z",
    items: [
      {
        id: 41,
        stock_item: 1,
        catalogue_product: 101,
        medication_label: "Paracetamol 500mg tablets — pack of 100 tablets",
        predicted_usage_units: 200,
        predicted_usage_packs: "2.00",
        current_stock_units: 50,
        current_stock_packs: "0.50",
        safety_stock_units: 50,
        suggested_reorder_units: 200,
        suggested_reorder_packs: 2,
        confidence: "0.60",
        explanation:
          "Based on 6 outbound stock movements over the last 90 days, average usage is 6.7 units/day. Forecast suggestion only. Review before action. Human review required.",
        history_points_count: 6,
        window_days: 90,
        created_at: "2026-06-20T10:00:00Z",
      },
    ],
    ...overrides,
  };
}

function makeTransferSuggestion(
  overrides: Partial<TransferSuggestion> = {},
): TransferSuggestion {
  return {
    id: 51,
    group: 1,
    catalogue_product: 201,
    medication_label: "Ibuprofen 400mg tablets — pack of 48 tablets",
    source_pharmacy: 1,
    source_pharmacy_name: "JMW Sutton",
    destination_pharmacy: 2,
    destination_pharmacy_name: "JMW Wimbledon",
    source_stock_item: 11,
    destination_stock_item: 12,
    suggested_quantity_units: 160,
    suggested_quantity_packs: 4,
    current_source_stock_units: 240,
    destination_recent_usage_units: 160,
    dead_days: 30,
    confidence: "0.65",
    reason:
      "JMW Sutton has 240 units with no outbound usage for 30 days. JMW Wimbledon used 160 units in the last 30 days. Human review required before transfer.",
    status: "OPEN",
    model_version: "transfer-baseline-1",
    generated_by: 10,
    created_at: "2026-06-20T10:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
    ...overrides,
  };
}

function mockGroupSignals() {
  getStockReviewQueueMock.mockResolvedValue(
    makeReviewQueue({
      summary: {
        total_items: 2,
        high_risk: 1,
        medium_risk: 1,
        low_risk: 0,
        mds_shortfall: 1,
        expiry_risk: 1,
        low_confidence: 1,
      },
      items: [
        {
          ...makeReviewQueue().items[0],
          pharmacy_id: 1,
          pharmacy_name: "JMW Sutton",
        },
        {
          ...makeReviewQueue().items[0],
          medication_id: 12,
          medication_name: "Cetirizine",
          pharmacy_id: 2,
          pharmacy_name: "JMW Wimbledon",
          risk_level: "medium",
          score: 60,
          reason_chips: ["Low stock"],
          signals: ["Stock risk"],
          required_units: 40,
          available_units: 24,
          shortfall_units: 0,
          forecast_confidence: "0.70",
          forecast_confidence_label: "Medium confidence",
          review_message: "Stock risk. Review before action.",
          stock_item_id: 2,
        },
      ],
    }),
  );
  getMdsDemandSignalMock.mockResolvedValue(
    makeMdsDemand({
      items: [
        {
          ...makeMdsDemand().items[0],
          pharmacy_id: 1,
          pharmacy_name: "JMW Sutton",
        },
        {
          ...makeMdsDemand().items[0],
          medication_id: 12,
          medication_name: "Cetirizine",
          pharmacy_id: 2,
          pharmacy_name: "JMW Wimbledon",
          required_units: 40,
          available_units: 24,
          shortfall_units: 0,
          cycles_affected: 1,
          patients_affected: 1,
          stock_item_id: 2,
        },
      ],
    }),
  );
  getExpiryRiskMock.mockResolvedValue(
    makeExpiryRisk({
      items: [
        {
          ...makeExpiryRisk().items[0],
          pharmacy_id: 1,
          pharmacy_name: "JMW Sutton",
        },
        {
          ...makeExpiryRisk().items[0],
          batch_number: "CET-001",
          medication_id: 12,
          medication_name: "Cetirizine",
          pharmacy_id: 2,
          pharmacy_name: "JMW Wimbledon",
          quantity: 8,
          estimated_value: "18.00",
          stock_item_id: 2,
        },
      ],
    }),
  );
  listTransferSuggestionsMock.mockResolvedValue([makeTransferSuggestion()]);
}

function analyticsAuth() {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "forecast.run": true,
        "forecast.view": true,
        "stock.view": true,
      },
      pharmacies: [{ id: 1, name: "JMW Sutton" }],
    }),
  });
}

function nonSuperTransferAuth() {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "forecast.run": true,
        "forecast.view": true,
        "stock.view": true,
        "transfer_suggestion.dismiss": true,
        "transfer_suggestion.generate": true,
        "transfer_suggestion.view": true,
      },
      role: "ADMIN",
      scope: {
        is_global: false,
        group_ids: [1],
        pharmacy_ids: [1, 2],
      },
      pharmacies: [
        { id: 1, name: "JMW Sutton" },
        { id: 2, name: "JMW Wimbledon" },
      ],
    }),
  });
}

function transferAuth(
  permissions: Record<string, boolean> = {
    "forecast.run": true,
    "forecast.view": true,
    "stock.view": true,
    "transfer_suggestion.dismiss": true,
    "transfer_suggestion.generate": true,
    "transfer_suggestion.view": true,
  },
) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions,
      role: "SUPERINTENDENT",
      scope: {
        is_global: false,
        group_ids: [1],
        pharmacy_ids: [1, 2],
      },
      pharmacies: [
        { id: 1, name: "JMW Sutton" },
        { id: 2, name: "JMW Wimbledon" },
      ],
    }),
  });
}

function renderAnalytics(auth = analyticsAuth()) {
  return renderWithProviders(<StockAnalyticsScreen />, {
    auth,
  });
}

describe("StockAnalyticsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dismissTransferSuggestionMock.mockResolvedValue(
      makeTransferSuggestion({ status: "DISMISSED" }),
    );
    generateForecastMock.mockResolvedValue(makeForecast());
    generateTransferSuggestionsMock.mockResolvedValue([makeTransferSuggestion()]);
    getExpiryRiskMock.mockResolvedValue(makeExpiryRisk());
    getLatestForecastMock.mockResolvedValue(makeForecast());
    getMdsDemandSignalMock.mockResolvedValue(makeMdsDemand());
    getStockReviewQueueMock.mockResolvedValue(makeReviewQueue());
    listTransferSuggestionsMock.mockResolvedValue([]);
  });

  it("renders the compact header and KPI strip", async () => {
    renderAnalytics();

    expect(
      await screen.findByRole("heading", { name: "Stock Intelligence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Operational signals for review before action."),
    ).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();

    const kpiStrip = screen.getByLabelText("Stock intelligence KPI strip");
    expect(within(kpiStrip).getByText("Items to review")).toBeInTheDocument();
    expect(within(kpiStrip).getByText("MDS shortfalls")).toBeInTheDocument();
    expect(within(kpiStrip).getByText("Expiry risk")).toBeInTheDocument();
    expect(within(kpiStrip).getByText("Value at risk")).toBeInTheDocument();
    expect(
      within(kpiStrip).getByText("Low-confidence items"),
    ).toBeInTheDocument();
  });

  it("shows superintendent users a branch grid before branch intelligence", async () => {
    mockGroupSignals();

    renderAnalytics(transferAuth());

    expect(
      await screen.findByText(
        "Simple group-level stock review for pharmacy operations.",
      ),
    ).toBeInTheDocument();
    const groupHeading = screen.getByRole("heading", { name: "Group overview" });
    const selectedRegion = await screen.findByRole("region", {
      name: "Selected branch intelligence",
    });
    expect(
      groupHeading.compareDocumentPosition(selectedRegion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const groupPanel = groupHeading.closest("section");
    expect(groupPanel).not.toBeNull();
    expect(
      within(groupPanel as HTMLElement).getByRole("heading", {
        name: "JMW Sutton",
      }),
    ).toBeInTheDocument();
    expect(
      within(groupPanel as HTMLElement).getByRole("heading", {
        name: "JMW Wimbledon",
      }),
    ).toBeInTheDocument();
    expect(within(groupPanel as HTMLElement).getByText("Branch #1")).toBeInTheDocument();
    expect(within(groupPanel as HTMLElement).getByText("Branch #2")).toBeInTheDocument();

    const suttonCard = within(groupPanel as HTMLElement)
      .getByRole("heading", { name: "JMW Sutton" })
      .closest("article");
    expect(suttonCard).not.toBeNull();
    expect(within(suttonCard as HTMLElement).getByText("Items to review")).toBeInTheDocument();
    expect(within(suttonCard as HTMLElement).getByText("MDS shortfalls")).toBeInTheDocument();
    expect(within(suttonCard as HTMLElement).getByText("Expiry risk")).toBeInTheDocument();
    expect(within(suttonCard as HTMLElement).getByText("Value at risk")).toBeInTheDocument();
    expect(within(suttonCard as HTMLElement).getByText("Low stock")).toBeInTheDocument();
    expect(
      within(suttonCard as HTMLElement).getByText("Transfer opportunities"),
    ).toBeInTheDocument();
  });

  it("selects a superintendent branch and keeps forecast controls branch-aware", async () => {
    const user = userEvent.setup();
    mockGroupSignals();

    renderAnalytics(transferAuth());

    const groupPanel = (await screen.findByRole("heading", {
      name: "Group overview",
    })).closest("section");
    expect(groupPanel).not.toBeNull();
    const wimbledonCard = within(groupPanel as HTMLElement)
      .getByRole("heading", { name: "JMW Wimbledon" })
      .closest("article");
    expect(wimbledonCard).not.toBeNull();

    await user.click(
      within(wimbledonCard as HTMLElement).getByRole("button", {
        name: "View branch",
      }),
    );

    expect(
      screen.getByRole("region", { name: "Selected branch intelligence" }),
    ).toHaveTextContent("JMW Wimbledon");
    expect((await screen.findAllByText("Cetirizine")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Amlodipine")).toBeNull();
    expect(screen.getAllByText("Selected branch forecast").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Forecast controls use JMW Wimbledon. Review before action."),
    ).toBeInTheDocument();
  });

  it("opens a prefilled transfer review without moving stock", async () => {
    const user = userEvent.setup();
    mockGroupSignals();

    renderAnalytics(transferAuth());

    expect(
      await screen.findByRole("heading", {
        name: "Transfer suggestions for JMW Sutton",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Ibuprofen 400mg tablets — pack of 48 tablets"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review transfer" }));

    const dialog = await screen.findByRole("dialog", { name: "Review transfer" });
    expect(within(dialog).getByText("Ibuprofen 400mg tablets — pack of 48 tablets")).toBeInTheDocument();
    expect(within(dialog).getByText("JMW Sutton")).toBeInTheDocument();
    expect(within(dialog).getByText("JMW Wimbledon")).toBeInTheDocument();
    expect(within(dialog).getByText("4 packs / 160 units")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Transfer must be completed through stock transfer workflow.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Open stock transfer workflow" }),
    ).toHaveAttribute("href", "/inventory/11");
    expect(dismissTransferSuggestionMock).not.toHaveBeenCalled();
  });

  it("keeps the branch grid hidden for a pharmacy-scoped user", async () => {
    renderAnalytics();

    expect(await screen.findByText("Stock review queue")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Group overview" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: /Transfer suggestions for/ }),
    ).toBeNull();
  });

  it("renders stock review queue mds demand and expiry risk panels", async () => {
    renderAnalytics();

    expect(await screen.findByText("Stock review queue")).toBeInTheDocument();
    expect(await screen.findByText("MDS shortfall")).toBeInTheDocument();
    expect(screen.getByText("High risk")).toBeInTheDocument();
    expect(screen.getByText("Order review")).toBeInTheDocument();
    expect(screen.getAllByText("40 shortfall").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Review before action. Human review required.").length,
    ).toBeGreaterThan(0);

    expect(screen.getByText("MDS demand signal")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Patients")).toBeInTheDocument();
    expect(screen.getAllByText("112").length).toBeGreaterThan(0);
    expect(screen.getByText("Mapped")).toBeInTheDocument();

    expect(screen.getByText("Expiry risk / value at risk")).toBeInTheDocument();
    expect(screen.getAllByText("Value at risk").length).toBeGreaterThan(0);
    expect(screen.getAllByText("£28.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bisoprolol").length).toBeGreaterThan(0);
    expect(screen.getAllByText("8-30 days").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Forecast confidence").length).toBeGreaterThan(0);
  });

  it("refetches read-only intelligence signals when signal horizon changes", async () => {
    const user = userEvent.setup();
    renderAnalytics();

    await screen.findByText("Stock review queue");
    await user.selectOptions(screen.getByLabelText("Signal horizon"), "60");

    await waitFor(() => {
      expect(getMdsDemandSignalMock).toHaveBeenCalledWith(1, 60);
      expect(getStockReviewQueueMock).toHaveBeenCalledWith(1, 60);
    });
  });

  it("renders compact stock review queue rows without the old attention table", async () => {
    renderAnalytics();

    await screen.findAllByText("Amlodipine");
    const reviewSection = (await screen.findByRole("heading", {
      name: "Stock review queue",
    }))
      .closest("section");
    expect(reviewSection).not.toBeNull();
    expect(
      within(reviewSection as HTMLElement).getByText("Amlodipine"),
    ).toBeInTheDocument();
    expect(
      within(reviewSection as HTMLElement).getByText("JMW Sutton"),
    ).toBeInTheDocument();
    expect(
      within(reviewSection as HTMLElement).getByText("MDS shortfall"),
    ).toBeInTheDocument();
    expect(
      within(reviewSection as HTMLElement).getAllByText("Low confidence").length,
    ).toBeGreaterThan(0);
    expect(
      within(reviewSection as HTMLElement).getByText("Score 100"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Attention table" }),
    ).toBeNull();
  });

  it("renders compact empty loading and error states", async () => {
    getStockReviewQueueMock.mockReturnValueOnce(new Promise(() => undefined));
    const loadingRender = renderAnalytics();

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    loadingRender.unmount();

    getStockReviewQueueMock.mockRejectedValue(new Error("No queue"));
    const errorRender = renderAnalytics();

    expect(
      await screen.findByText("Could not load stock review queue."),
    ).toBeInTheDocument();
    errorRender.unmount();

    getStockReviewQueueMock.mockResolvedValue(
      makeReviewQueue({
        summary: {
          total_items: 0,
          high_risk: 0,
          medium_risk: 0,
          low_risk: 0,
          mds_shortfall: 0,
          expiry_risk: 0,
          low_confidence: 0,
        },
        items: [],
      }),
    );
    getMdsDemandSignalMock.mockResolvedValue(
      makeMdsDemand({
        summary: {
          total_required_units: 0,
          total_available_units: 0,
          total_shortfall_units: 0,
          items_with_shortfall: 0,
          mapping_needed: 0,
          cycles_affected: 0,
          patients_affected: 0,
        },
        items: [],
      }),
    );
    getExpiryRiskMock.mockResolvedValue(
      makeExpiryRisk({
        summary: {
          expiring_within_30_days_units: 0,
          value_at_risk: "0.00",
          unpriced_risk_units: 0,
          products_affected: 0,
        },
        buckets: [],
        items: [],
      }),
    );
    renderAnalytics();

    expect(
      await screen.findByText("No suggested stock reviews."),
    ).toBeInTheDocument();
    expect(screen.getByText("No MDS demand signal.")).toBeInTheDocument();
    expect(screen.getByText("No expiry risk.")).toBeInTheDocument();
  });

  it("renders latest forecast suggestions with confidence packs and explanation", async () => {
    renderAnalytics();

    expect(await screen.findByText("Reorder forecasting")).toBeInTheDocument();
    expect(screen.getByText("Forecast suggestion")).toBeInTheDocument();
    expect(
      screen.getByText(/Estimated demand from stock movement history/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Paracetamol 500mg tablets — pack of 100 tablets"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("2 packs / 200 units").length).toBeGreaterThan(0);
    expect(screen.getByText("0.50 packs / 50 units")).toBeInTheDocument();
    expect(screen.getAllByText(/Medium confidence/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByText("Explanation"));
    expect(screen.getByText(/average usage is 6.7 units\/day/)).toBeInTheDocument();
  });

  it("generates a forecast for the selected pharmacy and horizon", async () => {
    const user = userEvent.setup();
    renderAnalytics();

    await screen.findByText("Paracetamol 500mg tablets — pack of 100 tablets");
    await user.selectOptions(screen.getByLabelText("Horizon"), "60");
    await user.click(screen.getByRole("button", { name: "Generate forecast" }));

    await waitFor(() => {
      expect(generateForecastMock.mock.calls[0]?.[0]).toEqual({
        pharmacy: 1,
        horizon_days: 60,
      });
    });
  });

  it("renders forecast empty loading and error states", async () => {
    getLatestForecastMock.mockReturnValueOnce(new Promise(() => undefined));
    const loadingRender = renderAnalytics();

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    loadingRender.unmount();

    getLatestForecastMock.mockRejectedValueOnce(new Error("No forecast"));
    const errorRender = renderAnalytics();

    expect(await screen.findByText("Could not load latest forecast.")).toBeInTheDocument();
    errorRender.unmount();

    getLatestForecastMock.mockResolvedValueOnce(null);
    renderAnalytics();

    expect(await screen.findByText("No forecast generated yet.")).toBeInTheDocument();
  });

  it("shows the existing transfer suggestions panel for non-super group users", async () => {
    listTransferSuggestionsMock.mockResolvedValue([makeTransferSuggestion()]);

    renderAnalytics(nonSuperTransferAuth());

    expect(
      await screen.findByRole("heading", {
        name: "Cross-branch stock suggestions",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Transfer suggestion")).toBeInTheDocument();
    expect(
      screen.getByText(/Human review required before transfer/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Ibuprofen 400mg tablets — pack of 48 tablets"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/JMW Sutton.*JMW Wimbledon/).length).toBeGreaterThan(0);
    expect(screen.getByText("4 packs / 160 units")).toBeInTheDocument();
    expect(screen.getAllByText(/Medium confidence/).length).toBeGreaterThan(0);
  });

  it("hides transfer suggestions panel without group-level permission", async () => {
    renderAnalytics(
      transferAuth({
        "forecast.run": true,
        "forecast.view": true,
        "stock.view": true,
      }),
    );

    expect(await screen.findByText("Group overview")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cross-branch stock suggestions" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: /Transfer suggestions for/ }),
    ).toBeNull();
    expect(listTransferSuggestionsMock).not.toHaveBeenCalled();
  });

  it("generates superintendent transfer suggestions for the selected group and review window", async () => {
    const user = userEvent.setup();
    renderAnalytics(transferAuth());

    await screen.findByRole("heading", {
      name: "Transfer suggestions for JMW Sutton",
    });
    await user.selectOptions(screen.getByLabelText("Review window"), "60");
    await user.click(
      screen.getByRole("button", { name: "Generate suggestions" }),
    );

    await waitFor(() => {
      expect(generateTransferSuggestionsMock.mock.calls[0]?.[0]).toEqual({
        group: 1,
        dead_days: 60,
      });
    });
  });

  it("dismisses transfer suggestions and refreshes the list", async () => {
    const user = userEvent.setup();
    listTransferSuggestionsMock
      .mockResolvedValueOnce([makeTransferSuggestion()])
      .mockResolvedValueOnce([]);

    renderAnalytics(nonSuperTransferAuth());

    await screen.findByText("Ibuprofen 400mg tablets — pack of 48 tablets");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(dismissTransferSuggestionMock.mock.calls[0]?.[0]).toBe(51);
    });
    expect(
      await screen.findByText("No transfer suggestions to review."),
    ).toBeInTheDocument();
  });

  it("renders transfer suggestion loading error and empty states", async () => {
    listTransferSuggestionsMock.mockReturnValueOnce(new Promise(() => undefined));
    const loadingRender = renderAnalytics(nonSuperTransferAuth());

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    loadingRender.unmount();

    listTransferSuggestionsMock.mockRejectedValueOnce(new Error("No suggestions"));
    const errorRender = renderAnalytics(nonSuperTransferAuth());

    expect(
      await screen.findByText("Could not load transfer suggestions."),
    ).toBeInTheDocument();
    errorRender.unmount();

    listTransferSuggestionsMock.mockResolvedValueOnce([]);
    renderAnalytics(nonSuperTransferAuth());

    expect(
      await screen.findByText("No transfer suggestions to review."),
    ).toBeInTheDocument();
  });

  it("does not render patient data fields or values", async () => {
    renderAnalytics();

    expect((await screen.findAllByText("Amlodipine")).length).toBeGreaterThan(0);
    for (const forbidden of [
      "patient_reference",
      "first_name",
      "last_name",
      "date_of_birth",
      "address",
      "phone",
      "dose_instructions",
      "note",
      "PRIVATE-PATIENT",
      "guaranteed forecast",
      "AI decided",
      "must order",
      "must transfer",
      "clinical recommendation",
      "diagnosis",
      "NHS integration",
      "NCRS",
      "automatic dispensing",
      "automatic ordering",
      "automatic transfer",
      "compliance proof",
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("adds stock intelligence to navigation for stock view users", () => {
    expect(NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Stock Intelligence",
          path: "/analytics",
          requiredAnyOf: ["stock.view"],
        }),
      ]),
    );
  });
});
