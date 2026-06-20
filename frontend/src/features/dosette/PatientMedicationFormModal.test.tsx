import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import type { Medication } from "../catalogue/catalogueApi";
import * as catalogueApi from "../catalogue/catalogueApi";
import type { PatientMedicationLine } from "./dosetteApi";
import * as dosetteApi from "./dosetteApi";
import { PatientMedicationFormModal } from "./PatientMedicationFormModal";

vi.mock("../catalogue/catalogueApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../catalogue/catalogueApi")>();
  return {
    ...actual,
    listMedications: vi.fn(),
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

const listMedicationsMock = vi.mocked(catalogueApi.listMedications);
const createPatientMedicationMock = vi.mocked(dosetteApi.createPatientMedication);
const updatePatientMedicationMock = vi.mocked(dosetteApi.updatePatientMedication);

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 10,
    group: 1,
    name: "Amlodipine",
    form: "TABLET",
    strength: "5 mg",
    manufacturer: "",
    notes: "",
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
    listMedicationsMock.mockResolvedValue([
      makeMedication(),
      makeMedication({
        id: 11,
        name: "Metformin",
        strength: "500 mg",
      }),
    ]);
    createPatientMedicationMock.mockResolvedValue(makeLine());
    updatePatientMedicationMock.mockResolvedValue(makeLine());
  });

  it("submits create payload", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    expect(await screen.findByRole("option", { name: "Metformin 500 mg" }))
      .toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Medication"), "11");
    await user.type(screen.getByLabelText("Dose instructions"), "Take with food");
    await user.clear(screen.getByLabelText("Morning"));
    await user.type(screen.getByLabelText("Morning"), "1");
    await user.clear(screen.getByLabelText("Lunchtime"));
    await user.type(screen.getByLabelText("Lunchtime"), "2");
    await user.clear(screen.getByLabelText("Evening"));
    await user.type(screen.getByLabelText("Evening"), "0");
    await user.clear(screen.getByLabelText("Bedtime"));
    await user.type(screen.getByLabelText("Bedtime"), "1");
    await user.type(screen.getByLabelText("Start date"), "2026-06-22");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createPatientMedicationMock).toHaveBeenCalledWith(20, {
        medication: 11,
        dose_instructions: "Take with food",
        quantity_morning: 1,
        quantity_lunchtime: 2,
        quantity_evening: 0,
        quantity_bedtime: 1,
        start_date: "2026-06-22",
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("submits edit payload", async () => {
    const user = userEvent.setup();
    renderModal({ line: makeLine() });

    await screen.findByLabelText("Medication");
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

    expect(await screen.findByLabelText("Medication")).toBeDisabled();
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

    expect(await screen.findByRole("option", { name: "Amlodipine 5 mg" }))
      .toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Medication"), "10");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "An active medication line for this medication already exists for this patient.",
      ),
    ).toBeInTheDocument();
  });
});
