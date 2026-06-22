import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/providers";
import { CatalogueProductSelect } from "./CatalogueProductSelect";
import type { CatalogueProduct } from "./catalogueApi";
import * as catalogueApi from "./catalogueApi";

vi.mock("./catalogueApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./catalogueApi")>();
  return {
    ...actual,
    listCatalogueProducts: vi.fn(),
  };
});

const listCatalogueProductsMock = vi.mocked(catalogueApi.listCatalogueProducts);

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

describe("CatalogueProductSelect", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listCatalogueProductsMock.mockResolvedValue([makeProduct()]);
  });

  it("renders search results and selects a product", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <CatalogueProductSelect selectedProduct={null} onSelect={onSelect} />,
    );

    await user.type(screen.getByLabelText("Catalogue product"), "amlo");
    await user.click(
      await screen.findByRole("option", {
        name: /Amlodipine 5mg tablets — pack of 28/,
      }),
    );

    expect(listCatalogueProductsMock).toHaveBeenCalledWith("amlo");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 101 }));
  });
});
