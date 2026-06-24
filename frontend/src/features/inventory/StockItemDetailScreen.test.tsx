import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { StockItemDetailScreen } from "./StockItemDetailScreen";
import type { StockItemDetail } from "./inventoryApi";
import * as inventoryApi from "./inventoryApi";

vi.mock("./inventoryApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./inventoryApi")>();
  return {
    ...actual,
    listStockItems: vi.fn(),
    getStockItem: vi.fn(),
  };
});

const getStockItemMock = vi.mocked(inventoryApi.getStockItem);

function makeStockItemDetail(
  overrides: Partial<StockItemDetail> = {},
): StockItemDetail {
  return {
    id: 20,
    pharmacy: 1,
    medication: 10,
    medication_name: "Paracetamol",
    unit_price: "0.03",
    reorder_level: 5,
    is_active: true,
    quantity_on_hand: 18,
    earliest_expiry: "2027-01-31",
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    batches: [
      {
        id: 3,
        batch_number: "LOT-B",
        expiry_date: "2027-06-30",
        quantity: 8,
        quantity_received: 8,
        received_at: "2026-02-01",
        is_active: true,
      },
      {
        id: 2,
        batch_number: "LOT-A",
        expiry_date: "2027-01-31",
        quantity: 10,
        quantity_received: 10,
        received_at: "2026-01-01",
        is_active: true,
      },
    ],
    ...overrides,
  };
}

function inventoryAuth() {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
      },
      pharmacies: [
        { id: 1, name: "JMW Sutton" },
        { id: 2, name: "JMW Croydon" },
      ],
    }),
  });
}

function renderDetail(route = "/inventory/20") {
  return renderWithProviders(
    <Routes>
      <Route
        element={<StockItemDetailScreen />}
        path="/inventory/:stockItemId"
      />
    </Routes>,
    { auth: inventoryAuth(), route },
  );
}

describe("StockItemDetailScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getStockItemMock.mockResolvedValue(makeStockItemDetail());
  });

  it("loads the stock item from the route parameter", async () => {
    renderDetail();

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(getStockItemMock).toHaveBeenCalledWith(20);
  });

  it("renders header fields and resolved pharmacy name", async () => {
    renderDetail();

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getAllByText("JMW Sutton").length).toBeGreaterThan(0);
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getAllByText("31 Jan 2027").length).toBeGreaterThan(0);
    expect(screen.getByText("£0.03")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("renders batches in the exact order returned by the API", async () => {
    const { container } = renderDetail();

    expect(await screen.findByText("LOT-B")).toBeInTheDocument();
    expect(screen.getByText("LOT-A")).toBeInTheDocument();
    const text = container.textContent ?? "";
    expect(text.indexOf("LOT-B")).toBeLessThan(text.indexOf("LOT-A"));
  });

  it("does not sort batches client-side", async () => {
    const { container } = renderDetail();

    expect(await screen.findByText("LOT-B")).toBeInTheDocument();
    const text = container.textContent ?? "";
    expect(text.indexOf("30 Jun 2027")).toBeLessThan(
      text.lastIndexOf("31 Jan 2027"),
    );
  });

  it("shows empty batches state", async () => {
    getStockItemMock.mockResolvedValue(makeStockItemDetail({ batches: [] }));

    renderDetail();

    expect(
      await screen.findByText("No batches recorded for this stock item."),
    ).toBeInTheDocument();
  });
});
