import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { CatalogueProduct } from "../catalogue/catalogueApi";
import * as catalogueApi from "../catalogue/catalogueApi";
import { InventoryScreen } from "./InventoryScreen";
import type {
  CatalogueStockIntakeResponse,
  StockItem,
  StockItemDetail,
} from "./inventoryApi";
import * as inventoryApi from "./inventoryApi";

vi.mock("../catalogue/catalogueApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../catalogue/catalogueApi")>();
  return {
    ...actual,
    listCatalogueProducts: vi.fn(),
  };
});

vi.mock("./inventoryApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./inventoryApi")>();
  return {
    ...actual,
    listStockItems: vi.fn(),
    getStockItem: vi.fn(),
    receiveCatalogueStock: vi.fn(),
  };
});

const listCatalogueProductsMock = vi.mocked(catalogueApi.listCatalogueProducts);
const listStockItemsMock = vi.mocked(inventoryApi.listStockItems);
const receiveCatalogueStockMock = vi.mocked(inventoryApi.receiveCatalogueStock);

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

function makeStockItemDetail(): StockItemDetail {
  return {
    ...makeStockItem(),
    batches: [],
  };
}

function makeProduct(overrides: Partial<CatalogueProduct> = {}): CatalogueProduct {
  return {
    id: 101,
    dmd_code: "SEED-AMLO-5",
    source: "SEED",
    vmp_name: "Amlodipine 5mg tablets",
    amp_name: "",
    display_name: "Amlodipine 5mg tablets",
    ingredient: "Amlodipine",
    strength: "5mg",
    dose_form: "tablets",
    pack_size: 28,
    pack_unit: "",
    manufacturer: "",
    appearance_colour: "",
    appearance_shape: "",
    appearance_form: "tablets",
    full_label: "Amlodipine 5mg tablets — pack of 28",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function intakeResponse(): CatalogueStockIntakeResponse {
  return {
    stock_item: makeStockItemDetail(),
    movement: {
      id: 1,
      movement_type: "RECEIPT",
      quantity_delta: 14000,
      balance_after: 14000,
      batch: 10,
    },
    intake: {
      packs_received: 500,
      pack_size: 28,
      pack_unit: "",
      quantity_received: 14000,
    },
  };
}

function inventoryAuth({
  pharmacyCount = 2,
  canReceive = false,
}: {
  pharmacyCount?: number;
  canReceive?: boolean;
} = {}) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
        "stock.receive": canReceive,
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
    listCatalogueProductsMock.mockResolvedValue([makeProduct()]);
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
    receiveCatalogueStockMock.mockResolvedValue(intakeResponse());
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
    renderWithProviders(<InventoryScreen />, {
      auth: inventoryAuth({ pharmacyCount: 1 }),
    });

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

  it("shows Add Stock button for users with stock.receive", async () => {
    renderWithProviders(<InventoryScreen />, {
      auth: inventoryAuth({ canReceive: true }),
    });

    expect(
      await screen.findByRole("button", { name: "Add Stock" }),
    ).toBeInTheDocument();
  });

  it("hides Add Stock button without stock.receive", async () => {
    renderWithProviders(<InventoryScreen />, { auth: inventoryAuth() });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Stock" })).toBeNull();
  });

  it("searches catalogue products and submits stock intake", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InventoryScreen />, {
      auth: inventoryAuth({ canReceive: true }),
    });

    await user.click(await screen.findByRole("button", { name: "Add Stock" }));
    const dialog = screen.getByRole("dialog", { name: "Add Stock" });
    await user.selectOptions(within(dialog).getByLabelText("Pharmacy"), "1");
    await user.type(within(dialog).getByLabelText("Catalogue product"), "amlo");
    await user.click(
      await screen.findByRole("option", {
        name: /Amlodipine 5mg tablets — pack of 28/,
      }),
    );
    expect(
      screen.getAllByText("Amlodipine 5mg tablets — pack of 28").length,
    ).toBeGreaterThan(0);

    await user.type(within(dialog).getByLabelText("Packs received"), "500");
    expect(
      screen.getByText("500 packs x 28 tablets = 14,000 tablets added"),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Batch number"), "AMLO123");
    await user.type(within(dialog).getByLabelText("Expiry date"), "2027-03-31");
    await user.click(within(dialog).getByRole("button", { name: "Add stock" }));

    await waitFor(() => {
      expect(receiveCatalogueStockMock).toHaveBeenCalledWith({
        pharmacy: 1,
        catalogue_product: 101,
        packs_received: 500,
        batch_number: "AMLO123",
        expiry_date: "2027-03-31",
        received_at: undefined,
        reference: undefined,
      });
    });
    await waitFor(() => {
      expect(listStockItemsMock).toHaveBeenCalledTimes(2);
    });
  });
});
