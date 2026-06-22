import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NAV_ITEMS } from "../../app/navConfig";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { ForecastRun, StockOverview } from "./analyticsApi";
import * as analyticsApi from "./analyticsApi";
import { StockAnalyticsScreen } from "./StockAnalyticsScreen";

vi.mock("./analyticsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./analyticsApi")>();
  return {
    ...actual,
    generateForecast: vi.fn(),
    getLatestForecast: vi.fn(),
    getStockAnalyticsOverview: vi.fn(),
  };
});

const generateForecastMock = vi.mocked(analyticsApi.generateForecast);
const getLatestForecastMock = vi.mocked(analyticsApi.getLatestForecast);
const getStockAnalyticsOverviewMock = vi.mocked(
  analyticsApi.getStockAnalyticsOverview,
);

function makeOverview(overrides: Partial<StockOverview> = {}): StockOverview {
  return {
    generated_at: "2026-06-20T10:00:00Z",
    thresholds: {
      near_expiry_days: 90,
      dead_stock_days: 90,
      slow_moving_threshold: 5,
    },
    summary: {
      total_items: 2,
      stockout: 1,
      low_stock: 1,
      near_expiry: 1,
      dead_stock: 1,
      slow_moving: 1,
      needs_attention: 2,
    },
    items: [
      {
        stock_item_id: 1,
        medication_id: 10,
        medication_name: "Amlodipine",
        pharmacy_id: 7,
        quantity_on_hand: 0,
        reorder_level: 20,
        earliest_expiry: null,
        days_to_expiry: null,
        consumption_window: 0,
        flags: {
          stockout: true,
          low_stock: false,
          near_expiry: false,
          dead_stock: false,
          slow_moving: false,
        },
        attention_score: 50,
        suggested_reorder_quantity: 20,
        reasons: [
          "Stockout: 0 units on hand",
          "Reorder suggested: 20 units to reach reorder level",
        ],
      },
      {
        stock_item_id: 2,
        medication_id: 11,
        medication_name: "Bisoprolol",
        pharmacy_id: 8,
        quantity_on_hand: 3,
        reorder_level: 20,
        earliest_expiry: "2026-07-01",
        days_to_expiry: 11,
        consumption_window: 2,
        flags: {
          stockout: false,
          low_stock: true,
          near_expiry: true,
          dead_stock: true,
          slow_moving: true,
        },
        attention_score: 70,
        suggested_reorder_quantity: 17,
        reasons: [
          "Low stock: 3 on hand at or below reorder level 20",
          "Near expiry: earliest batch expires in 11 days",
          "Dead stock: no outbound movement in 90 days",
          "Slow moving: only 2 units consumed in 90 days",
        ],
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
          "Based on 6 outbound stock movements over the last 90 days, average usage is 6.7 units/day. Forecast suggestion only; human review required before ordering.",
        history_points_count: 6,
        window_days: 90,
        created_at: "2026-06-20T10:00:00Z",
      },
    ],
    ...overrides,
  };
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

function renderAnalytics() {
  return renderWithProviders(<StockAnalyticsScreen />, {
    auth: analyticsAuth(),
  });
}

describe("StockAnalyticsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    generateForecastMock.mockResolvedValue(makeForecast());
    getLatestForecastMock.mockResolvedValue(makeForecast());
    getStockAnalyticsOverviewMock.mockResolvedValue(makeOverview());
  });

  it("renders summary counters", async () => {
    renderAnalytics();

    expect(
      await screen.findByRole("heading", { name: "Stock Intelligence" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Total items")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getAllByText("Stockout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Low stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Near expiry").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dead stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Slow moving").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("renders attention rows in returned order", async () => {
    renderAnalytics();

    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
    const attentionSection = screen
      .getByRole("heading", { name: "Attention table" })
      .closest("section");
    expect(attentionSection).not.toBeNull();
    const rows = within(attentionSection as HTMLElement).getAllByRole("row");
    const medicationRows = rows.slice(1);
    expect(within(medicationRows[0]).getByText("Amlodipine")).toBeInTheDocument();
    expect(within(medicationRows[1]).getByText("Bisoprolol")).toBeInTheDocument();
  });

  it("renders flags reasons attention and reorder values", async () => {
    renderAnalytics();

    const bisoprololRow = (await screen.findByText("Bisoprolol")).closest("tr");
    expect(bisoprololRow).not.toBeNull();
    expect(within(bisoprololRow as HTMLElement).getByText("Low stock")).toBeInTheDocument();
    expect(within(bisoprololRow as HTMLElement).getByText("Near expiry")).toBeInTheDocument();
    expect(within(bisoprololRow as HTMLElement).getByText("Dead stock")).toBeInTheDocument();
    expect(within(bisoprololRow as HTMLElement).getByText("Slow moving")).toBeInTheDocument();
    expect(within(bisoprololRow as HTMLElement).getByText("70")).toBeInTheDocument();
    expect(within(bisoprololRow as HTMLElement).getByText("17")).toBeInTheDocument();
    expect(
      within(bisoprololRow as HTMLElement).getByText(
        "Near expiry: earliest batch expires in 11 days",
      ),
    ).toBeInTheDocument();
    expect(
      within(bisoprololRow as HTMLElement).getByText(
        "Slow moving: only 2 units consumed in 90 days",
      ),
    ).toBeInTheDocument();
  });

  it("renders loading error and empty states", async () => {
    getStockAnalyticsOverviewMock.mockReturnValueOnce(new Promise(() => undefined));
    const loadingRender = renderAnalytics();

    expect(screen.getByText("Loading stock intelligence...")).toBeInTheDocument();
    loadingRender.unmount();

    getStockAnalyticsOverviewMock.mockRejectedValue(new Error("No analytics"));
    const errorRender = renderAnalytics();

    expect(
      await screen.findByText("Could not load stock intelligence."),
    ).toBeInTheDocument();
    errorRender.unmount();

    getStockAnalyticsOverviewMock.mockResolvedValue(
      makeOverview({
        summary: {
          total_items: 0,
          stockout: 0,
          low_stock: 0,
          near_expiry: 0,
          dead_stock: 0,
          slow_moving: 0,
          needs_attention: 0,
        },
        items: [],
      }),
    );
    renderAnalytics();

    expect(
      await screen.findByText("No stock analytics to display."),
    ).toBeInTheDocument();
  });

  it("renders latest forecast suggestions with confidence packs and explanation", async () => {
    renderAnalytics();

    expect(await screen.findByText("Reorder forecasting")).toBeInTheDocument();
    expect(screen.getByText("Forecast suggestion")).toBeInTheDocument();
    expect(screen.getByText(/Human review required before ordering/)).toBeInTheDocument();
    expect(
      await screen.findByText("Paracetamol 500mg tablets — pack of 100 tablets"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("2 packs / 200 units").length).toBeGreaterThan(0);
    expect(screen.getByText("0.50 packs / 50 units")).toBeInTheDocument();
    expect(screen.getByText("60% confidence")).toBeInTheDocument();
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

    expect(screen.getByText("Loading latest forecast...")).toBeInTheDocument();
    loadingRender.unmount();

    getLatestForecastMock.mockRejectedValueOnce(new Error("No forecast"));
    const errorRender = renderAnalytics();

    expect(await screen.findByText("Could not load latest forecast.")).toBeInTheDocument();
    errorRender.unmount();

    getLatestForecastMock.mockResolvedValueOnce(null);
    renderAnalytics();

    expect(await screen.findByText("No forecast generated yet.")).toBeInTheDocument();
  });

  it("does not render patient data fields or values", async () => {
    renderAnalytics();

    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
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
