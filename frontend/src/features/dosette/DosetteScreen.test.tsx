import { Route, Routes } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { DosetteScreen } from "./DosetteScreen";
import type {
  DosetteCycle,
  PatientMedicationLine,
  PickingList,
} from "./dosetteApi";
import * as dosetteApi from "./dosetteApi";

vi.mock("./dosetteApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dosetteApi")>();
  return {
    ...actual,
    listPatientMedications: vi.fn(),
    listDosetteCycles: vi.fn(),
    getPickingList: vi.fn(),
  };
});

const listPatientMedicationsMock = vi.mocked(dosetteApi.listPatientMedications);
const listDosetteCyclesMock = vi.mocked(dosetteApi.listDosetteCycles);
const getPickingListMock = vi.mocked(dosetteApi.getPickingList);

function makeLine(
  overrides: Partial<PatientMedicationLine> = {},
): PatientMedicationLine {
  return {
    id: 1,
    medication: 10,
    medication_name: "Amlodipine",
    strength: "5 mg",
    form: "TABLET",
    quantity_morning: 1,
    quantity_lunchtime: 0,
    quantity_evening: 0,
    quantity_bedtime: 1,
    start_date: "2026-06-01",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function makeCycle(overrides: Partial<DosetteCycle> = {}): DosetteCycle {
  return {
    id: 40,
    reference: "MDS-2026-W26",
    frequency: "WEEKLY",
    start_date: "2026-06-22",
    end_date: "2026-06-28",
    status: "DRAFT",
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function makePickingList(overrides: Partial<PickingList> = {}): PickingList {
  return {
    cycle: {
      id: 40,
      reference: "MDS-2026-W26",
      frequency: "WEEKLY",
      start_date: "2026-06-22",
      end_date: "2026-06-28",
      status: "DRAFT",
    },
    patient_reference: "SUT-P1",
    medications: [
      {
        medication_id: 10,
        medication_name: "Amlodipine",
        strength: "5 mg",
        form: "TABLET",
        quantity_morning: 1,
        quantity_lunchtime: 0,
        quantity_evening: 0,
        quantity_bedtime: 1,
        total_daily: 2,
      },
      {
        medication_id: 11,
        medication_name: "Metformin",
        strength: "500 mg",
        form: "TABLET",
        quantity_morning: 1,
        quantity_lunchtime: 0,
        quantity_evening: 1,
        quantity_bedtime: 0,
        total_daily: 2,
      },
    ],
    totals: {
      morning: 2,
      lunchtime: 0,
      evening: 1,
      bedtime: 1,
      total_daily: 4,
    },
    ...overrides,
  };
}

function dosetteAuth() {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "blister.view": true,
      },
    }),
  });
}

function renderDosette(route = "/patients/20/dosette") {
  return renderWithProviders(
    <Routes>
      <Route element={<DosetteScreen />} path="/patients/:patientId/dosette" />
    </Routes>,
    { auth: dosetteAuth(), route },
  );
}

describe("DosetteScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listPatientMedicationsMock.mockResolvedValue([
      makeLine(),
      makeLine({
        id: 2,
        medication: 11,
        medication_name: "Metformin",
        strength: "500 mg",
        quantity_morning: 1,
        quantity_evening: 1,
        quantity_bedtime: 0,
      }),
      makeLine({
        id: 3,
        medication: 12,
        medication_name: "Inactive line",
        is_active: false,
        quantity_morning: 0,
        quantity_bedtime: 0,
      }),
    ]);
    listDosetteCyclesMock.mockResolvedValue([
      makeCycle(),
      makeCycle({
        id: 41,
        reference: "MDS-2026-FW07",
        frequency: "FOUR_WEEKLY",
        start_date: "2026-06-01",
        status: "PREPARED",
      }),
    ]);
    getPickingListMock.mockResolvedValue(makePickingList());
  });

  it("renders medication lines", async () => {
    renderDosette();

    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
    expect(screen.getAllByText("5 mg / TABLET").length).toBeGreaterThan(0);
    expect(screen.getByText("Metformin")).toBeInTheDocument();
    expect(screen.getByText("Inactive line")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("renders cycles", async () => {
    renderDosette();

    expect(await screen.findByText("MDS-2026-W26")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText("22 Jun 2026 - 28 Jun 2026")).toBeInTheDocument();
    expect(screen.getByText("MDS-2026-FW07")).toBeInTheDocument();
    expect(screen.getByText("Prepared")).toBeInTheDocument();
  });

  it("selecting a cycle renders picking-list rows and totals", async () => {
    const user = userEvent.setup();
    renderDosette();

    const actions = await screen.findAllByRole("button", {
      name: "View picking list",
    });
    await user.click(actions[0]);

    expect(getPickingListMock).toHaveBeenCalledWith(20, 40);
    expect(await screen.findByText("Picking list: MDS-2026-W26")).toBeInTheDocument();
    const pickingList = screen.getByText("Picking list: MDS-2026-W26").closest(
      "section",
    );
    expect(pickingList).not.toBeNull();
    expect(within(pickingList as HTMLElement).getByText("SUT-P1")).toBeInTheDocument();
    expect(
      within(pickingList as HTMLElement).getAllByText("Amlodipine").length,
    ).toBeGreaterThan(0);
    expect(within(pickingList as HTMLElement).getByText("Metformin")).toBeInTheDocument();
    expect(within(pickingList as HTMLElement).getByText("Totals")).toBeInTheDocument();
    expect(
      within(pickingList as HTMLElement).getAllByText("4").length,
    ).toBeGreaterThan(0);
  });

  it("handles loading, error, and empty states", async () => {
    listPatientMedicationsMock.mockReturnValueOnce(new Promise(() => undefined));
    listDosetteCyclesMock.mockReturnValueOnce(new Promise(() => undefined));
    const { unmount } = renderDosette();

    expect(screen.getByText("Loading medication lines...")).toBeInTheDocument();
    expect(screen.getByText("Loading cycles...")).toBeInTheDocument();
    unmount();

    listPatientMedicationsMock.mockRejectedValueOnce(new Error("No medication lines"));
    listDosetteCyclesMock.mockRejectedValueOnce(new Error("No cycles"));
    const errorRender = renderDosette();

    expect(
      await screen.findByText("Could not load medication lines."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Could not load cycles.")).toBeInTheDocument();
    errorRender.unmount();

    listPatientMedicationsMock.mockResolvedValueOnce([]);
    listDosetteCyclesMock.mockResolvedValueOnce([]);
    renderDosette();

    expect(await screen.findByText("No medication lines yet.")).toBeInTheDocument();
    expect(await screen.findByText("No dosette cycles yet.")).toBeInTheDocument();
  });

  it("does not render mutation controls or dose instructions", async () => {
    listPatientMedicationsMock.mockResolvedValueOnce([
      makeLine({
        // Simulates an unexpected backend field without typing or rendering it.
        ...({ dose_instructions: "Private dose directions" } as Partial<
          PatientMedicationLine
        >),
      }),
    ]);
    renderDosette();

    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /prepare/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
    expect(screen.queryByText("Private dose directions")).toBeNull();
    expect(screen.queryByText("dose_instructions")).toBeNull();
  });
});
