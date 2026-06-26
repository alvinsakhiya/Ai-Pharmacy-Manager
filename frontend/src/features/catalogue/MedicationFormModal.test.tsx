import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { Group } from "../tenancy/tenancyApi";
import * as tenancyApi from "../tenancy/tenancyApi";
import { MedicationFormModal } from "./MedicationFormModal";
import type { Medication } from "./catalogueApi";
import * as catalogueApi from "./catalogueApi";

vi.mock("./catalogueApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./catalogueApi")>();
  return {
    ...actual,
    listMedications: vi.fn(),
    listCatalogueProducts: vi.fn(),
    createMedication: vi.fn(),
    updateMedication: vi.fn(),
  };
});

vi.mock("../tenancy/tenancyApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tenancy/tenancyApi")>();
  return {
    ...actual,
    listGroups: vi.fn(),
  };
});

const listMedicationsMock = vi.mocked(catalogueApi.listMedications);
const listCatalogueProductsMock = vi.mocked(catalogueApi.listCatalogueProducts);
const createMedicationMock = vi.mocked(catalogueApi.createMedication);
const updateMedicationMock = vi.mocked(catalogueApi.updateMedication);
const listGroupsMock = vi.mocked(tenancyApi.listGroups);

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 20,
    group: 1,
    catalogue_product: null,
    catalogue_product_full_label: null,
    catalogue_product_pack_size: null,
    catalogue_product_pack_unit: "",
    name: "Paracetamol",
    form: "TABLET",
    strength: "500 mg",
    manufacturer: "Generic",
    notes: "Keep in catalogue",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function makeProduct(
  overrides: Partial<catalogueApi.CatalogueProduct> = {},
): catalogueApi.CatalogueProduct {
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

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 1,
    name: "North Group",
    slug: "north-group",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function medicationAuth({
  isGlobal = true,
  groupIds = [],
}: {
  isGlobal?: boolean;
  groupIds?: number[];
} = {}) {
  return makeAuthContext({
    user: makeAuthUser({
      role: isGlobal ? "ADMIN" : "PHARMACIST",
      scope: {
        is_global: isGlobal,
        group_ids: groupIds,
        pharmacy_ids: isGlobal ? [] : [10],
      },
      permissions: {
        "medication.view": true,
        "medication.manage": true,
      },
    }),
  });
}

describe("MedicationFormModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listMedicationsMock.mockResolvedValue([makeMedication()]);
    listCatalogueProductsMock.mockResolvedValue([makeProduct()]);
    listGroupsMock.mockResolvedValue([
      makeGroup(),
      makeGroup({ id: 2, name: "South Group", slug: "south-group" }),
    ]);
    createMedicationMock.mockResolvedValue(makeMedication());
    updateMedicationMock.mockResolvedValue(makeMedication());
  });

  it("create submit calls createMedication with the selected catalogue product", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth() },
    );

    expect(screen.getByText("Add product from catalogue")).toBeInTheDocument();
    expect(
      screen.getByText(/Select a canonical catalogue product/),
    ).toBeInTheDocument();
    await screen.findByRole("option", { name: "North Group" });
    await user.selectOptions(screen.getByLabelText("Group"), "1");
    await user.type(screen.getByLabelText("Catalogue product"), "amlo");
    await user.click(
      await screen.findByRole("option", {
        name: /Amlodipine 5mg tablets — pack of 28/,
      }),
    );
    await user.type(screen.getByLabelText("Notes"), "Once daily");
    await user.click(
      screen.getByRole("button", { name: "Enable product locally" }),
    );

    await waitFor(() => {
      expect(createMedicationMock).toHaveBeenCalledWith({
        group: 1,
        catalogue_product: 101,
        notes: "Once daily",
        is_active: true,
      });
    });
  });

  it("edit form shows derived fields read-only and submits only editable fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal
        medication={makeMedication({
          catalogue_product: 101,
          catalogue_product_full_label: "Paracetamol 500mg tablets — pack of 100",
          catalogue_product_pack_size: 100,
        })}
        isOpen
        onClose={vi.fn()}
      />,
      { auth: medicationAuth() },
    );

    expect(screen.getByLabelText("Group")).toHaveValue("1");
    expect(screen.getByLabelText("Group")).toBeDisabled();
    expect(screen.getByText("Paracetamol 500mg tablets — pack of 100")).toBeInTheDocument();
    expect(screen.getByText("Tablet")).toBeInTheDocument();
    expect(screen.getByText("500 mg")).toBeInTheDocument();
    expect(screen.getByText("Generic")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByLabelText("Strength")).toBeNull();
    expect(screen.getByLabelText("Notes")).toHaveValue("Keep in catalogue");

    await user.click(screen.getByLabelText("Active"));
    await user.click(screen.getByRole("button", { name: "Save local settings" }));

    await waitFor(() => {
      expect(updateMedicationMock).toHaveBeenCalledWith(20, {
        notes: "Keep in catalogue",
        is_active: false,
      });
    });
  });

  it("renders backend catalogue product errors", async () => {
    createMedicationMock.mockRejectedValue(
      new ApiError(400, {
        catalogue_product: ["Select a catalogue product."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth() },
    );

    await screen.findByRole("option", { name: "North Group" });
    await user.selectOptions(screen.getByLabelText("Group"), "1");
    await user.type(screen.getByLabelText("Catalogue product"), "amlo");
    await user.click(
      await screen.findByRole("option", {
        name: /Amlodipine 5mg tablets — pack of 28/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Enable product locally" }),
    );

    expect(
      await screen.findByText("Select a catalogue product."),
    ).toBeInTheDocument();
  });

  it("required-field validation blocks missing catalogue product", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth() },
    );

    await screen.findByRole("option", { name: "North Group" });
    await user.selectOptions(screen.getByLabelText("Group"), "1");
    await user.click(
      screen.getByRole("button", { name: "Enable product locally" }),
    );

    expect(
      await screen.findByText("Select a catalogue product."),
    ).toBeInTheDocument();
    expect(createMedicationMock).not.toHaveBeenCalled();
  });

  it("does not expose free-text medicine fields in create mode", async () => {
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth() },
    );

    await screen.findByRole("option", { name: "North Group" });

    expect(screen.getByLabelText("Catalogue product")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.queryByLabelText("Strength")).toBeNull();
    expect(screen.queryByLabelText("Manufacturer")).toBeNull();
  });

  it("non-admin create derives a single group without calling listGroups", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth({ isGlobal: false, groupIds: [7] }) },
    );

    expect(screen.getByLabelText("Group")).toHaveValue("7");
    expect(screen.getByLabelText("Group")).toBeDisabled();
    await user.type(screen.getByLabelText("Catalogue product"), "amlo");
    await user.click(
      await screen.findByRole("option", {
        name: /Amlodipine 5mg tablets — pack of 28/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Enable product locally" }),
    );

    await waitFor(() => {
      expect(createMedicationMock).toHaveBeenCalledWith({
        group: 7,
        catalogue_product: 101,
        notes: "",
        is_active: true,
      });
    });
    expect(listGroupsMock).not.toHaveBeenCalled();
  });

  it("non-admin with no resolvable group disables submit and shows note", async () => {
    listMedicationsMock.mockResolvedValue([]);

    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth({ isGlobal: false }) },
    );

    expect(
      await screen.findByText(
        "Ask an administrator or superintendent to add the first catalogue product for this group.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enable product locally" }),
    ).toBeDisabled();
    expect(listGroupsMock).not.toHaveBeenCalled();
  });
});
