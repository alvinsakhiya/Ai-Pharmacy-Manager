import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { InventoryScreen } from "./InventoryScreen";
import type { StockItem } from "./inventoryApi";
import * as inventoryApi from "./inventoryApi";

vi.mock("./inventoryApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./inventoryApi")>();
  return {
    ...actual,
    listStockItems: vi.fn(),
    getStockItem: vi.fn(),
  };
});

const listStockItemsMock = vi.mocked(inventoryApi.listStockItems);

function makeStockItem(overrides: Partial<StockItem> = {}): StockItem {
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
    ...overrides,
  };
}

function inventoryAuth(pharmacyCount = 2) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
      },
      pharmacies: [
        { id: 1, name: "JMW Sutton" },
        { id: 2, name: "JMW Croydon" },
      ].slice(0, pharmacyCount),
    }),
  });
}

describe("InventoryScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listStockItemsMock.mockResolvedValue([
      makeStockItem(),
      makeStockItem({
        id: 21,
        pharmacy: 2,
        medication_name: "Ibuprofen",
        quantity_on_hand: 4,
        earliest_expiry: null,
        is_active: false,
      }),
    ]);
  });

  it("renders rows from stock item data with resolved pharmacy names", async () => {
    renderWithProviders(<InventoryScreen />, { auth: inventoryAuth() });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getAllByText("JMW Sutton").length).toBeGreaterThan(0);
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Ibuprofen")).toBeInTheDocument();
    expect(screen.getAllByText("JMW Croydon").length).toBeGreaterThan(0);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    listStockItemsMock.mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<InventoryScreen />, { auth: inventoryAuth() });

    expect(screen.getByText("Loading stock...")).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    listStockItemsMock.mockResolvedValue([]);

    renderWithProviders(<InventoryScreen />, { auth: inventoryAuth() });

    expect(await screen.findByText("No stock items yet.")).toBeInTheDocument();
  });

  it("links each row to the stock item detail screen", async () => {
    renderWithProviders(<InventoryScreen />, { auth: inventoryAuth() });

    const viewLinks = await screen.findAllByRole("link", { name: "View" });

    expect(viewLinks[0]).toHaveAttribute("href", "/inventory/20");
  });

  it("shows pharmacy filter when user has more than one pharmacy", async () => {
    renderWithProviders(<InventoryScreen />, { auth: inventoryAuth() });

    expect(await screen.findByLabelText("Pharmacy")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "All pharmacies" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "JMW Sutton" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "JMW Croydon" })).toBeInTheDocument();
  });

  it("does not show pharmacy filter for a single scoped pharmacy", () => {
    renderWithProviders(<InventoryScreen />, { auth: inventoryAuth(1) });

    expect(screen.queryByLabelText("Pharmacy")).toBeNull();
  });

  it("passes selected pharmacy to the list query", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InventoryScreen />, { auth: inventoryAuth() });

    await screen.findByText("Paracetamol");
    await user.selectOptions(screen.getByLabelText("Pharmacy"), "2");

    await waitFor(() => {
      expect(listStockItemsMock).toHaveBeenLastCalledWith({ pharmacy: 2 });
    });
  });
});
