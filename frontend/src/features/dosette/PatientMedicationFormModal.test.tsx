import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import type { CatalogueProduct } from "../catalogue/catalogueApi";
import * as catalogueApi from "../catalogue/catalogueApi";
import type { PatientMedicationLine } from "./dosetteApi";
import * as dosetteApi from "./dosetteApi";
import { PatientMedicationFormModal } from "./PatientMedicationFormModal";

vi.mock("../catalogue/catalogueApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../catalogue/catalogueApi")>();
  return {
    ...actual,
    listCatalogueProducts: vi.fn(),
  };
});

vi.mock("./dosetteApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dosetteApi")>();
  return {
    ...actual,
    createPatientMedication: vi.fn(),
    updatePatientMedication: vi.fn(),
    discontinuePatientMedication: vi.fn(),
  };
});

const listCatalogueProductsMock = vi.mocked(catalogueApi.listCatalogueProducts);
const createPatientMedicationMock = vi.mocked(dosetteApi.createPatientMedication);
const updatePatientMedicationMock = vi.mocked(dosetteApi.updatePatientMedication);

function makeProduct(overrides: Partial<CatalogueProduct> = {}): CatalogueProduct {
  return {
    id: 101,
    dmd_code: "SEED-IBU-400",
    source: "SEED",
    vmp_name: "Ibuprofen 400mg tablets",
    amp_name: "",
    display_name: "Ibuprofen 400mg tablets",
    ingredient: "Ibuprofen",
    strength: "400mg",
    dose_form: "tablets",
    pack_size: 28,
    pack_unit: "tablets",
    manufacturer: "",
    appearance_colour: "",
    appearance_shape: "",
    appearance_form: "tablets",
    full_label: "Ibuprofen 400mg tablets — pack of 28 tablets",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function makeLine(
  overrides: Partial<PatientMedicationLine> = {},
): PatientMedicationLine {
  return {
    id: 30,
    medication: 10,
    medication_name: "Amlodipine",
    dose_instructions: "Take in the morning",
    strength: "5 mg",
    form: "TABLET",
    quantity_morning: 1,
    quantity_lunchtime: 0,
    quantity_evening: 0,
    quantity_bedtime: 1,
    start_date: "2026-06-22",
    colour: "",
    shape: "",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function renderModal({
  line = null,
  onClose = vi.fn(),
}: {
  line?: PatientMedicationLine | null;
  onClose?: () => void;
} = {}) {
  renderWithProviders(
    <PatientMedicationFormModal
      isOpen
      line={line}
      onClose={onClose}
      patientId={20}
    />,
  );
  return { onClose };
}

describe("PatientMedicationFormModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listCatalogueProductsMock.mockResolvedValue([makeProduct()]);
    createPatientMedicationMock.mockResolvedValue(makeLine());
    updatePatientMedicationMock.mockResolvedValue(makeLine());
  });

  it("searches the full catalogue and submits create payload with catalogue_product", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByLabelText("Catalogue product"), "ibuprofen 400");
    await user.click(
      await screen.findByRole("option", {
        name: /Ibuprofen 400mg tablets — pack of 28 tablets/,
      }),
    );
    expect(listCatalogueProductsMock).toHaveBeenCalledWith("ibuprofen 400");
    expect(screen.getByLabelText("Selected catalogue product")).toHaveTextContent(
      "Ibuprofen 400mg tablets — pack of 28 tablets",
    );
    expect(screen.getByLabelText("Selected catalogue product")).toHaveTextContent(
      "400mg",
    );
    expect(screen.getByLabelText("Selected catalogue product")).toHaveTextContent(
      "tablets",
    );
    expect(screen.getByLabelText("Selected catalogue product")).toHaveTextContent(
      "28 tablets",
    );
    await user.type(screen.getByLabelText("Dose instructions"), "Take with food");
    await user.clear(screen.getByLabelText("Morning"));
    await user.type(screen.getByLabelText("Morning"), "1");
    await user.clear(screen.getByLabelText("Lunchtime"));
    await user.type(screen.getByLabelText("Lunchtime"), "2");
    await user.clear(screen.getByLabelText("Evening"));
    await user.type(screen.getByLabelText("Evening"), "0");
    await user.clear(screen.getByLabelText("Bedtime"));
    await user.type(screen.getByLabelText("Bedtime"), "1");
    expect(screen.queryByLabelText("Start date")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createPatientMedicationMock).toHaveBeenCalledWith(20, {
        catalogue_product: 101,
        dose_instructions: "Take with food",
        quantity_morning: 1,
        quantity_lunchtime: 2,
        quantity_evening: 0,
        quantity_bedtime: 1,
        start_date: null,
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("submits edit payload", async () => {
    const user = userEvent.setup();
    renderModal({ line: makeLine() });

    await screen.findByLabelText("Selected medication");
    expect(screen.queryByLabelText("Start date")).toBeNull();
    await user.clear(screen.getByLabelText("Dose instructions"));
    await user.type(screen.getByLabelText("Dose instructions"), "Updated directions");
    await user.clear(screen.getByLabelText("Bedtime"));
    await user.type(screen.getByLabelText("Bedtime"), "2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updatePatientMedicationMock).toHaveBeenCalledWith(20, 30, {
        medication: 10,
        dose_instructions: "Updated directions",
        quantity_morning: 1,
        quantity_lunchtime: 0,
        quantity_evening: 0,
        quantity_bedtime: 2,
        start_date: "2026-06-22",
      });
    });
  });

  it("locks medication field on edit", async () => {
    renderModal({ line: makeLine() });

    expect(await screen.findByLabelText("Selected medication")).toHaveTextContent(
      "Amlodipine",
    );
    expect(screen.queryByLabelText("Catalogue product")).toBeNull();
  });

  it("renders backend field errors", async () => {
    const user = userEvent.setup();
    createPatientMedicationMock.mockRejectedValue(
      new ApiError(400, {
        medication: [
          "An active medication line for this medication already exists for this patient.",
        ],
      }),
    );
    renderModal();

    await user.type(screen.getByLabelText("Catalogue product"), "ibuprofen");
    await user.click(
      await screen.findByRole("option", {
        name: /Ibuprofen 400mg tablets — pack of 28 tablets/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "An active medication line for this medication already exists for this patient.",
      ),
    ).toBeInTheDocument();
  });
});
