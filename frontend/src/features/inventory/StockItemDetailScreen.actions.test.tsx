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
    getStockItem: vi.fn(),
  };
});

const getStockItemMock = vi.mocked(inventoryApi.getStockItem);

function makeStockItemDetail(): StockItemDetail {
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
        id: 30,
        batch_number: "LOT-100",
        expiry_date: "2027-01-31",
        quantity: 18,
        quantity_received: 20,
        received_at: "2026-01-01",
        is_active: true,
      },
    ],
  };
}

function inventoryAuth({
  canManage,
  canTransfer = false,
}: {
  canManage: boolean;
  canTransfer?: boolean;
}) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
        "stock.manage": canManage,
        "stock.transfer": canTransfer,
      },
      pharmacies: [{ id: 1, name: "JMW Sutton" }],
    }),
  });
}

function renderDetail({
  canManage,
  canTransfer = false,
}: {
  canManage: boolean;
  canTransfer?: boolean;
}) {
  return renderWithProviders(
    <Routes>
      <Route
        element={<StockItemDetailScreen />}
        path="/inventory/:stockItemId"
      />
    </Routes>,
    { auth: inventoryAuth({ canManage, canTransfer }), route: "/inventory/20" },
  );
}

describe("StockItemDetailScreen actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getStockItemMock.mockResolvedValue(makeStockItemDetail());
  });

  it("shows receive adjust and count actions for stock.manage users", async () => {
    renderDetail({ canManage: true });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Receive stock" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjust" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Count" })).toBeInTheDocument();
  });

  it("shows transfer for stock.transfer users", async () => {
    renderDetail({ canManage: true, canTransfer: true });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer" })).toBeInTheDocument();
  });

  it("shows adjust and count but not transfer for stock.manage-only users", async () => {
    renderDetail({ canManage: true });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjust" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Count" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transfer" })).toBeNull();
  });

  it("hides action controls and column for view-only users", async () => {
    renderDetail({ canManage: false });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receive stock" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Adjust" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Count" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Transfer" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).toBeNull();
  });
});
