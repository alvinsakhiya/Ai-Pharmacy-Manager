import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { MedicationsScreen } from "./MedicationsScreen";
import type { Medication } from "./catalogueApi";
import * as catalogueApi from "./catalogueApi";

vi.mock("./catalogueApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./catalogueApi")>();
  return {
    ...actual,
    listMedications: vi.fn(),
    createMedication: vi.fn(),
    updateMedication: vi.fn(),
  };
});

const listMedicationsMock = vi.mocked(catalogueApi.listMedications);

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
    manufacturer: "",
    notes: "",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function medicationAuth(canManage = true) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "medication.view": true,
        "medication.manage": canManage,
      },
    }),
  });
}

describe("MedicationsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listMedicationsMock.mockResolvedValue([
      makeMedication(),
      makeMedication({
        id: 21,
        catalogue_product: 101,
        catalogue_product_full_label: "Salbutamol 100mcg inhaler — pack of 1",
        catalogue_product_pack_size: 1,
        name: "Salbutamol",
        form: "INHALER",
        strength: "100 micrograms/dose",
        manufacturer: "Respira",
        is_active: false,
      }),
    ]);
  });

  it("renders medication rows", async () => {
    renderWithProviders(<MedicationsScreen />, { auth: medicationAuth() });

    expect(screen.getByText("Loading medications...")).toBeInTheDocument();
    expect(await screen.findByText("Medication Library")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Search and enable catalogue products used for stock, MDS/Dosette, and reports.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This library shows catalogue products that are enabled/),
    ).toBeInTheDocument();
    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.getByText("Legacy")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Legacy records were created before catalogue selection and should be reviewed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Tablet")).toBeInTheDocument();
    expect(
      screen.getByText("Salbutamol 100mcg inhaler — pack of 1"),
    ).toBeInTheDocument();
    expect(screen.getByText("Inhaler")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Respira")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    listMedicationsMock.mockResolvedValue([]);

    renderWithProviders(<MedicationsScreen />, { auth: medicationAuth() });

    expect(
      await screen.findByText("No catalogue products enabled yet."),
    ).toBeInTheDocument();
  });

  it("shows add from catalogue button for users with medication.manage", async () => {
    renderWithProviders(<MedicationsScreen />, { auth: medicationAuth(true) });

    expect(
      await screen.findByRole("button", { name: "Add from catalogue" }),
    ).toBeInTheDocument();
  });

  it("hides add from catalogue button for view-only users", async () => {
    renderWithProviders(<MedicationsScreen />, { auth: medicationAuth(false) });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add from catalogue" }),
    ).toBeNull();
  });

  it("hides row edit for view-only users", async () => {
    renderWithProviders(<MedicationsScreen />, { auth: medicationAuth(false) });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Local settings" })).toBeNull();
  });

  it("does not render a delete control", async () => {
    renderWithProviders(<MedicationsScreen />, { auth: medicationAuth() });

    expect(await screen.findByText("Paracetamol")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});
