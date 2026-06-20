import { Route, Routes } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { Medication } from "../catalogue/catalogueApi";
import * as catalogueApi from "../catalogue/catalogueApi";
import { DosetteScreen } from "./DosetteScreen";
import type {
  DosetteCycle,
  PatientMedicationLine,
  PickingList,
} from "./dosetteApi";
import * as dosetteApi from "./dosetteApi";

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
    listPatientMedications: vi.fn(),
    listDosetteCycles: vi.fn(),
    getPickingList: vi.fn(),
    createPatientMedication: vi.fn(),
    updatePatientMedication: vi.fn(),
    discontinuePatientMedication: vi.fn(),
  };
});

const listMedicationsMock = vi.mocked(catalogueApi.listMedications);
const listPatientMedicationsMock = vi.mocked(dosetteApi.listPatientMedications);
const listDosetteCyclesMock = vi.mocked(dosetteApi.listDosetteCycles);
const getPickingListMock = vi.mocked(dosetteApi.getPickingList);
const discontinuePatientMedicationMock = vi.mocked(
  dosetteApi.discontinuePatientMedication,
);

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
    id: 1,
    medication: 10,
    medication_name: "Amlodipine",
    dose_instructions: "Private dose directions",
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

function dosetteAuth(permissions: Record<string, boolean> = {}) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "blister.view": true,
        ...permissions,
      },
    }),
  });
}

function renderDosette(
  route = "/patients/20/dosette",
  auth = dosetteAuth(),
) {
  return renderWithProviders(
    <Routes>
      <Route element={<DosetteScreen />} path="/patients/:patientId/dosette" />
    </Routes>,
    { auth, route },
  );
}

describe("DosetteScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listMedicationsMock.mockResolvedValue([
      makeMedication(),
      makeMedication({ id: 11, name: "Metformin", strength: "500 mg" }),
    ]);
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
    discontinuePatientMedicationMock.mockResolvedValue(
      makeLine({ is_active: false }),
    );
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

  it("shows medication management controls with blister manage", async () => {
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add medication" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Discontinue" })).toHaveLength(2);
  });

  it("hides medication management controls with only blister view", async () => {
    renderDosette();

    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add medication" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discontinue" })).toBeNull();
  });

  it("discontinue confirmation calls API and refetches medication and picking-list data", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    await user.click(
      (await screen.findAllByRole("button", { name: "View picking list" }))[0],
    );
    expect(await screen.findByText("Picking list: MDS-2026-W26")).toBeInTheDocument();
    const medicationCallsBefore = listPatientMedicationsMock.mock.calls.length;
    const pickingCallsBefore = getPickingListMock.mock.calls.length;

    await user.click(screen.getAllByRole("button", { name: "Discontinue" })[0]);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Discontinue",
      }),
    );

    await waitFor(() => {
      expect(discontinuePatientMedicationMock).toHaveBeenCalledWith(20, 1);
    });
    await waitFor(() => {
      expect(listPatientMedicationsMock.mock.calls.length).toBeGreaterThan(
        medicationCallsBefore,
      );
      expect(getPickingListMock.mock.calls.length).toBeGreaterThan(
        pickingCallsBefore,
      );
    });
  });

  it("does not add cycle management controls", async () => {
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect(await screen.findByText("MDS-2026-W26")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create cycle/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^prepare$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).toBeNull();
  });

  it("does not render mutation controls for view-only users or dose instructions in picking list", async () => {
    listPatientMedicationsMock.mockResolvedValueOnce([
      makeLine({
        dose_instructions: "Private dose directions",
      }),
    ]);
    renderDosette();

    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /prepare/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "View picking list" }))[0],
    );
    expect(await screen.findByText("Picking list: MDS-2026-W26")).toBeInTheDocument();
    expect(screen.queryByText("Private dose directions")).toBeNull();
    expect(screen.queryByText("dose_instructions")).toBeNull();
  });
});
