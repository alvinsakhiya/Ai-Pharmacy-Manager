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
  StockPreview,
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
    getStockPreview: vi.fn(),
    createPatientMedication: vi.fn(),
    updatePatientMedication: vi.fn(),
    discontinuePatientMedication: vi.fn(),
    createDosetteCycle: vi.fn(),
    updateDosetteCycle: vi.fn(),
    prepareDosetteCycle: vi.fn(),
    cancelDosetteCycle: vi.fn(),
  };
});

const listMedicationsMock = vi.mocked(catalogueApi.listMedications);
const listPatientMedicationsMock = vi.mocked(dosetteApi.listPatientMedications);
const listDosetteCyclesMock = vi.mocked(dosetteApi.listDosetteCycles);
const getPickingListMock = vi.mocked(dosetteApi.getPickingList);
const getStockPreviewMock = vi.mocked(dosetteApi.getStockPreview);
const discontinuePatientMedicationMock = vi.mocked(
  dosetteApi.discontinuePatientMedication,
);
const prepareDosetteCycleMock = vi.mocked(dosetteApi.prepareDosetteCycle);
const cancelDosetteCycleMock = vi.mocked(dosetteApi.cancelDosetteCycle);

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

function makeStockPreview(overrides: Partial<StockPreview> = {}): StockPreview {
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
    pharmacy_id: 7,
    medications: [
      {
        medication_id: 10,
        medication_name: "Amlodipine",
        strength: "5 mg",
        form: "TABLET",
        required_quantity: 2,
        available_quantity: 8,
        shortage_quantity: 0,
        in_stock: true,
        earliest_expiry: "2026-07-10",
        suggested_batches: [
          {
            batch_id: 501,
            batch_number: "AML-FEFO-1",
            expiry_date: "2026-07-10",
            quantity_available: 8,
            quantity_to_pick: 2,
          },
        ],
      },
      {
        medication_id: 11,
        medication_name: "Metformin",
        strength: "500 mg",
        form: "TABLET",
        required_quantity: 4,
        available_quantity: 1,
        shortage_quantity: 3,
        in_stock: false,
        earliest_expiry: "2026-07-20",
        suggested_batches: [
          {
            batch_id: 601,
            batch_number: "MET-FEFO-1",
            expiry_date: "2026-07-20",
            quantity_available: 1,
            quantity_to_pick: 1,
          },
        ],
      },
    ],
    totals: {
      required: 6,
      available: 9,
      shortage: 3,
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
    getStockPreviewMock.mockResolvedValue(makeStockPreview());
    discontinuePatientMedicationMock.mockResolvedValue(
      makeLine({ is_active: false }),
    );
    prepareDosetteCycleMock.mockResolvedValue(
      makeCycle({ status: "PREPARED" }),
    );
    cancelDosetteCycleMock.mockResolvedValue(
      makeCycle({ status: "CANCELLED" }),
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

  it("selecting a cycle renders stock preview values badges and FEFO batches", async () => {
    const user = userEvent.setup();
    renderDosette();

    await user.click(
      (await screen.findAllByRole("button", { name: "View picking list" }))[0],
    );

    expect(getStockPreviewMock).toHaveBeenCalledWith(20, 40);
    expect(
      await screen.findByRole("heading", { name: "Stock availability" }),
    ).toBeInTheDocument();
    const stockSection = screen
      .getByRole("heading", { name: "Stock availability" })
      .closest("section");
    expect(stockSection).not.toBeNull();

    const amlodipineRow = within(stockSection as HTMLElement)
      .getByText("Amlodipine")
      .closest("tr");
    const metforminRow = within(stockSection as HTMLElement)
      .getByText("Metformin")
      .closest("tr");
    expect(amlodipineRow).not.toBeNull();
    expect(metforminRow).not.toBeNull();

    expect(within(amlodipineRow as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(within(amlodipineRow as HTMLElement).getByText("8")).toBeInTheDocument();
    expect(within(amlodipineRow as HTMLElement).getByText("0")).toBeInTheDocument();
    expect(
      within(amlodipineRow as HTMLElement).getByText("In stock"),
    ).toBeInTheDocument();
    expect(
      within(amlodipineRow as HTMLElement).getByText("AML-FEFO-1"),
    ).toBeInTheDocument();
    expect(
      within(amlodipineRow as HTMLElement).getByText("10 Jul 2026 - pick 2"),
    ).toBeInTheDocument();

    expect(within(metforminRow as HTMLElement).getByText("4")).toBeInTheDocument();
    expect(within(metforminRow as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(metforminRow as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(
      within(metforminRow as HTMLElement).getByText("Shortage"),
    ).toBeInTheDocument();
    expect(
      within(metforminRow as HTMLElement).getByText("MET-FEFO-1"),
    ).toBeInTheDocument();
    expect(
      within(metforminRow as HTMLElement).getByText("20 Jul 2026 - pick 1"),
    ).toBeInTheDocument();

    expect(within(stockSection as HTMLElement).getByText("Totals")).toBeInTheDocument();
    expect(
      within(stockSection as HTMLElement).getAllByText("6").length,
    ).toBeGreaterThan(0);
    expect(
      within(stockSection as HTMLElement).getAllByText("9").length,
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

  it("handles stock preview loading error and empty states", async () => {
    const user = userEvent.setup();
    getStockPreviewMock.mockReturnValueOnce(new Promise(() => undefined));
    const loadingRender = renderDosette();

    await user.click(
      (await screen.findAllByRole("button", { name: "View picking list" }))[0],
    );
    expect(await screen.findByText("Loading stock availability...")).toBeInTheDocument();
    loadingRender.unmount();

    getStockPreviewMock.mockRejectedValueOnce(new Error("No stock preview"));
    const errorRender = renderDosette();

    await user.click(
      (await screen.findAllByRole("button", { name: "View picking list" }))[0],
    );
    expect(
      await screen.findByText("Could not load stock availability."),
    ).toBeInTheDocument();
    errorRender.unmount();

    getStockPreviewMock.mockResolvedValueOnce(makeStockPreview({ medications: [] }));
    renderDosette();

    await user.click(
      (await screen.findAllByRole("button", { name: "View picking list" }))[0],
    );
    expect(
      await screen.findByText("No active medication lines to preview."),
    ).toBeInTheDocument();
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
    const medicationSection = screen.getByText("Medication lines").closest("section");
    expect(medicationSection).not.toBeNull();
    expect(
      within(medicationSection as HTMLElement).getAllByRole("button", {
        name: "Edit",
      }),
    ).toHaveLength(3);
    expect(
      within(medicationSection as HTMLElement).getAllByRole("button", {
        name: "Discontinue",
      }),
    ).toHaveLength(2);
  });

  it("hides medication management controls with only blister view", async () => {
    renderDosette();

    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add medication" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discontinue" })).toBeNull();
  });

  it("discontinue confirmation calls API and refetches medication picking-list and stock-preview data", async () => {
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
    const stockPreviewCallsBefore = getStockPreviewMock.mock.calls.length;

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
      expect(getStockPreviewMock.mock.calls.length).toBeGreaterThan(
        stockPreviewCallsBefore,
      );
    });
  });

  it("shows cycle add edit and cancel with blister manage", async () => {
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect(await screen.findByText("MDS-2026-W26")).toBeInTheDocument();
    const cyclesSection = screen.getByText("Cycles").closest("section");
    expect(cyclesSection).not.toBeNull();
    expect(
      within(cyclesSection as HTMLElement).getByRole("button", {
        name: "Add cycle",
      }),
    ).toBeInTheDocument();
    expect(
      within(cyclesSection as HTMLElement).getAllByRole("button", {
        name: "Edit",
      }),
    ).toHaveLength(2);
    expect(
      within(cyclesSection as HTMLElement).getAllByRole("button", {
        name: "Cancel",
      }),
    ).toHaveLength(2);
  });

  it("hides cycle add edit and cancel with only blister view", async () => {
    renderDosette();

    expect(await screen.findByText("MDS-2026-W26")).toBeInTheDocument();
    const cyclesSection = screen.getByText("Cycles").closest("section");
    expect(cyclesSection).not.toBeNull();
    expect(
      within(cyclesSection as HTMLElement).queryByRole("button", {
        name: "Add cycle",
      }),
    ).toBeNull();
    expect(
      within(cyclesSection as HTMLElement).queryByRole("button", {
        name: "Edit",
      }),
    ).toBeNull();
    expect(
      within(cyclesSection as HTMLElement).queryByRole("button", {
        name: "Cancel",
      }),
    ).toBeNull();
  });

  it("shows prepare only with mark-prepared permission and only for draft cycles", async () => {
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.mark_prepared": true }),
    );

    expect(await screen.findByText("MDS-2026-W26")).toBeInTheDocument();
    const cyclesSection = screen.getByText("Cycles").closest("section");
    expect(cyclesSection).not.toBeNull();
    expect(
      within(cyclesSection as HTMLElement).getAllByRole("button", {
        name: "Prepare",
      }),
    ).toHaveLength(1);

    const draftRow = screen.getByText("MDS-2026-W26").closest("tr");
    const preparedRow = screen.getByText("MDS-2026-FW07").closest("tr");
    expect(draftRow).not.toBeNull();
    expect(preparedRow).not.toBeNull();
    expect(
      within(draftRow as HTMLElement).getByRole("button", { name: "Prepare" }),
    ).toBeInTheDocument();
    expect(
      within(preparedRow as HTMLElement).queryByRole("button", {
        name: "Prepare",
      }),
    ).toBeNull();
  });

  it("hides prepare without mark-prepared permission", async () => {
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect(await screen.findByText("MDS-2026-W26")).toBeInTheDocument();
    const cyclesSection = screen.getByText("Cycles").closest("section");
    expect(cyclesSection).not.toBeNull();
    expect(
      within(cyclesSection as HTMLElement).queryByRole("button", {
        name: "Prepare",
      }),
    ).toBeNull();
  });

  it("shows cancel only for draft or prepared cycles", async () => {
    listDosetteCyclesMock.mockResolvedValueOnce([
      makeCycle(),
      makeCycle({
        id: 41,
        reference: "MDS-2026-FW07",
        status: "PREPARED",
      }),
      makeCycle({
        id: 42,
        reference: "MDS-2026-CANCELLED",
        status: "CANCELLED",
      }),
      makeCycle({
        id: 43,
        reference: "MDS-2026-COMPLETED",
        status: "COMPLETED",
      }),
    ]);
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect(await screen.findByText("MDS-2026-COMPLETED")).toBeInTheDocument();
    const cyclesSection = screen.getByText("Cycles").closest("section");
    expect(cyclesSection).not.toBeNull();
    expect(
      within(cyclesSection as HTMLElement).getAllByRole("button", {
        name: "Cancel",
      }),
    ).toHaveLength(2);
    expect(
      within(screen.getByText("MDS-2026-CANCELLED").closest("tr") as HTMLElement)
        .queryByRole("button", { name: "Cancel" }),
    ).toBeNull();
    expect(
      within(screen.getByText("MDS-2026-COMPLETED").closest("tr") as HTMLElement)
        .queryByRole("button", { name: "Cancel" }),
    ).toBeNull();
  });

  it("prepare confirmation calls API and refetches cycles picking-list and stock-preview data", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.mark_prepared": true }),
    );

    await user.click(
      (await screen.findAllByRole("button", { name: "View picking list" }))[0],
    );
    expect(await screen.findByText("Picking list: MDS-2026-W26")).toBeInTheDocument();
    const cycleCallsBefore = listDosetteCyclesMock.mock.calls.length;
    const pickingCallsBefore = getPickingListMock.mock.calls.length;
    const stockPreviewCallsBefore = getStockPreviewMock.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Prepare" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Prepare",
      }),
    );

    await waitFor(() => {
      expect(prepareDosetteCycleMock).toHaveBeenCalledWith(20, 40);
    });
    await waitFor(() => {
      expect(listDosetteCyclesMock.mock.calls.length).toBeGreaterThan(
        cycleCallsBefore,
      );
      expect(getPickingListMock.mock.calls.length).toBeGreaterThan(
        pickingCallsBefore,
      );
      expect(getStockPreviewMock.mock.calls.length).toBeGreaterThan(
        stockPreviewCallsBefore,
      );
    });
  });

  it("cancel confirmation calls API and refetches cycles picking-list and stock-preview data", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    await user.click(
      (await screen.findAllByRole("button", { name: "View picking list" }))[0],
    );
    expect(await screen.findByText("Picking list: MDS-2026-W26")).toBeInTheDocument();
    const cycleCallsBefore = listDosetteCyclesMock.mock.calls.length;
    const pickingCallsBefore = getPickingListMock.mock.calls.length;
    const stockPreviewCallsBefore = getStockPreviewMock.mock.calls.length;

    await user.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel cycle",
      }),
    );

    await waitFor(() => {
      expect(cancelDosetteCycleMock).toHaveBeenCalledWith(20, 40);
    });
    await waitFor(() => {
      expect(listDosetteCyclesMock.mock.calls.length).toBeGreaterThan(
        cycleCallsBefore,
      );
      expect(getPickingListMock.mock.calls.length).toBeGreaterThan(
        pickingCallsBefore,
      );
      expect(getStockPreviewMock.mock.calls.length).toBeGreaterThan(
        stockPreviewCallsBefore,
      );
    });
  });

  it("does not add checked completed picking-list stock mutation reservation deduction or label controls", async () => {
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({
        "blister.manage": true,
        "blister.mark_prepared": true,
      }),
    );

    expect(await screen.findByText("MDS-2026-W26")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^check$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^complete$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /stock/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /movement/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reserve/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reservation/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /deduct/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /deduction/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /label/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /update picking list/i }),
    ).toBeNull();
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
