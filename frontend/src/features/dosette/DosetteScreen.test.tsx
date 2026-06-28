import { Route, Routes } from "react-router-dom";
import type { QueryClient } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { ApiError } from "../../lib/apiClient";
import type { CatalogueProduct, Medication } from "../catalogue/catalogueApi";
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
    listCatalogueProducts: vi.fn(),
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
    deductDosetteStock: vi.fn(),
    updateMedicationAppearance: vi.fn(),
  };
});

const listMedicationsMock = vi.mocked(catalogueApi.listMedications);
const listCatalogueProductsMock = vi.mocked(catalogueApi.listCatalogueProducts);
const listPatientMedicationsMock = vi.mocked(dosetteApi.listPatientMedications);
const listDosetteCyclesMock = vi.mocked(dosetteApi.listDosetteCycles);
const getPickingListMock = vi.mocked(dosetteApi.getPickingList);
const getStockPreviewMock = vi.mocked(dosetteApi.getStockPreview);
const createPatientMedicationMock = vi.mocked(dosetteApi.createPatientMedication);
const updatePatientMedicationMock = vi.mocked(dosetteApi.updatePatientMedication);
const createDosetteCycleMock = vi.mocked(dosetteApi.createDosetteCycle);
const discontinuePatientMedicationMock = vi.mocked(
  dosetteApi.discontinuePatientMedication,
);
const prepareDosetteCycleMock = vi.mocked(dosetteApi.prepareDosetteCycle);
const cancelDosetteCycleMock = vi.mocked(dosetteApi.cancelDosetteCycle);
const deductDosetteStockMock = vi.mocked(dosetteApi.deductDosetteStock);
const updateMedicationAppearanceMock = vi.mocked(
  dosetteApi.updateMedicationAppearance,
);

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 10,
    group: 1,
    catalogue_product: null,
    catalogue_product_full_label: null,
    catalogue_product_pack_size: null,
    catalogue_product_pack_unit: "",
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

function makeCatalogueProduct(
  overrides: Partial<CatalogueProduct> = {},
): CatalogueProduct {
  return {
    id: 210,
    dmd_code: "DMD-210",
    source: "dm+d",
    vmp_name: "Paracetamol 500mg tablets",
    amp_name: "",
    display_name: "Paracetamol 500mg tablets",
    ingredient: "Paracetamol",
    strength: "500 mg",
    dose_form: "TABLET",
    pack_size: 32,
    pack_unit: "tablets",
    manufacturer: "",
    appearance_colour: "White",
    appearance_shape: "Round",
    appearance_form: "Tablet",
    full_label: "Paracetamol 500mg tablets",
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
    colour: "Blue",
    shape: "Round",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

const SUPPLY_LABELS: Record<string, string> = {
  WEEKLY: "1-week supply",
  FORTNIGHTLY: "2-week supply",
  FOUR_WEEKLY: "4-week supply",
  MONTHLY: "Monthly supply",
};

function formatCycleTestDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function makeCycle(overrides: Partial<DosetteCycle> = {}): DosetteCycle {
  const cycle: DosetteCycle = {
    id: 40,
    reference: "MDS-2026-W26",
    patient_reference: "SUT-P1",
    display_label: "",
    supply_period_label: "",
    frequency: "WEEKLY",
    start_date: "2026-06-22",
    end_date: "2026-06-28",
    due_status: "upcoming",
    days_until_due: 10,
    is_due_soon: false,
    status: "DRAFT",
    stock_deducted: false,
    deducted_at: null,
    prepared_by_email: null,
    prepared_at: null,
    checked_by_email: null,
    checked_at: null,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
  const supplyLabel =
    overrides.supply_period_label ??
    SUPPLY_LABELS[cycle.frequency] ??
    cycle.frequency;
  return {
    ...cycle,
    supply_period_label: supplyLabel,
    display_label:
      overrides.display_label ??
      `${cycle.patient_reference} · ${supplyLabel} · ${formatCycleTestDate(
        cycle.start_date,
      )} - ${formatCycleTestDate(cycle.end_date)}`,
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
        colour: "Blue",
        shape: "Round",
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
        colour: "White",
        shape: "Oval",
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
      pharmacies: [{ id: 7, name: "JMW Sutton" }],
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
  queryClient?: QueryClient,
) {
  return renderWithProviders(
    <Routes>
      <Route element={<DosetteScreen />} path="/patients/:patientId/dosette" />
    </Routes>,
    { auth, queryClient, route },
  );
}

function getCycleArticle(reference: string): HTMLElement {
  return screen.getByRole("article", { name: `Cycle ${reference}` });
}

const DEFAULT_PICKING_LIST_HEADING =
  "Picking list: SUT-P1 · 1-week supply · 22 Jun 2026 - 28 Jun 2026";

async function generatePickingList(user: ReturnType<typeof userEvent.setup>) {
  const selectButtons = await screen.findAllByRole("button", {
    name: "Select cycle",
  });
  await user.click(selectButtons[0]);
  expect(screen.queryByText(DEFAULT_PICKING_LIST_HEADING)).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Generate picking list" }),
  );
}

describe("DosetteScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listMedicationsMock.mockResolvedValue([
      makeMedication(),
      makeMedication({ id: 11, name: "Metformin", strength: "500 mg" }),
    ]);
    listCatalogueProductsMock.mockResolvedValue([makeCatalogueProduct()]);
    listPatientMedicationsMock.mockResolvedValue([
      makeLine(),
      makeLine({
        id: 2,
        medication: 11,
        medication_name: "Metformin",
        dose_instructions: "Take with evening meal",
        strength: "500 mg",
        quantity_morning: 1,
        quantity_evening: 1,
        quantity_bedtime: 0,
        colour: "White",
        shape: "Oval",
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
    createPatientMedicationMock.mockResolvedValue(
      makeLine({
        id: 4,
        medication: 13,
        medication_name: "Paracetamol",
        strength: "500 mg",
        quantity_morning: 0,
        quantity_bedtime: 2,
        colour: "White",
        shape: "Round",
      }),
    );
    updatePatientMedicationMock.mockResolvedValue(makeLine({ quantity_morning: 2 }));
    discontinuePatientMedicationMock.mockResolvedValue(
      makeLine({ is_active: false }),
    );
    prepareDosetteCycleMock.mockResolvedValue(
      makeCycle({ status: "PREPARED" }),
    );
    cancelDosetteCycleMock.mockResolvedValue(
      makeCycle({ status: "CANCELLED" }),
    );
    updateMedicationAppearanceMock.mockResolvedValue(
      makeLine({ colour: "White", shape: "Oval" }),
    );
    deductDosetteStockMock.mockResolvedValue({
      cycle: {
        id: 41,
        reference: "MDS-2026-FW07",
        status: "PREPARED",
        stock_deducted: true,
        deducted_at: "2026-06-20T09:30:00Z",
      },
      cycle_days: 7,
      patient_reference: "SUT-P1",
      deductions: [
        {
          medication_id: 10,
          medication_name: "Amlodipine",
          required_quantity: 14,
          movements: [
            {
              movement_id: 99,
              batch_id: 501,
              batch_number: "AML-FEFO-1",
              expiry_date: "2026-07-10",
              quantity_deducted: 14,
              balance_after: 36,
            },
          ],
        },
      ],
      totals: {
        required: 14,
        deducted: 14,
      },
    });
  });

  it("renders the MDS tray builder with days dose-times and saved slot medicines", async () => {
    renderDosette();

    expect(await screen.findByText("MDS tray builder")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Click a dose-time cell to add or update a medicine for that schedule.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This tray repeats the saved dose slots across the cycle using the current MDS schedule model. Review before preparation.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();

    const tray = screen.getByRole("table", { name: "MDS tray builder" });
    for (const day of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]) {
      expect(within(tray).getByText(day)).toBeInTheDocument();
    }
    for (const doseTime of ["Morning", "Lunchtime", "Evening", "Bedtime"]) {
      expect(within(tray).getByText(doseTime)).toBeInTheDocument();
    }

    const mondayMorning = within(tray).getByLabelText("Monday Morning tray cell");
    expect(within(mondayMorning).getByText("Amlodipine")).toBeInTheDocument();
    expect(within(mondayMorning).getByText("Metformin")).toBeInTheDocument();
    expect(within(mondayMorning).getByText("5 mg / TABLET")).toBeInTheDocument();
    expect(within(mondayMorning).getByText("500 mg / TABLET")).toBeInTheDocument();
    expect(within(mondayMorning).getAllByText("1 tablet").length).toBeGreaterThan(
      0,
    );
    expect(within(mondayMorning).getByText("Blue · Round")).toBeInTheDocument();

    const mondayLunchtime = within(tray).getByLabelText(
      "Monday Lunchtime tray cell",
    );
    expect(within(mondayLunchtime).getByText("Add medicine")).toBeInTheDocument();
    expect(within(mondayLunchtime).queryByText("Amlodipine")).toBeNull();

    const tuesdayBedtime = within(tray).getByLabelText(
      "Tuesday Bedtime tray cell",
    );
    expect(within(tuesdayBedtime).getByText("Amlodipine")).toBeInTheDocument();
    expect(within(tuesdayBedtime).queryByText("Metformin")).toBeNull();
    expect(within(tray).queryByText("Inactive line")).toBeNull();
  });

  it("opens an inline editor from a tray cell without a modal", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Morning tray cell"));

    expect(screen.queryByRole("dialog")).toBeNull();
    const editor = screen.getByRole("region", { name: "Inline medicine editor" });
    expect(within(editor).getByText("Selected cell")).toBeInTheDocument();
    expect(within(editor).getByText("Monday · Morning")).toBeInTheDocument();
    expect(
      within(editor).getByText(
        "Timing will be saved as Morning and repeated across the cycle.",
      ),
    ).toBeInTheDocument();
    expect(within(editor).getByText("Medicines in this dose-time")).toBeInTheDocument();
    expect(
      within(editor).getByRole("button", { name: "Add another medicine" }),
    ).toBeInTheDocument();
    expect(
      within(editor).getAllByRole("button", { name: "Edit medicine" }),
    ).toHaveLength(2);
  });

  it("updates the selected Morning slot through the existing medication payload", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Morning tray cell"));
    const editor = screen.getByRole("region", { name: "Inline medicine editor" });
    const amlodipineCard = within(editor).getByRole("article", {
      name: "Medicine in Morning Amlodipine",
    });
    await user.click(within(amlodipineCard).getByRole("button", { name: "Edit medicine" }));
    await user.clear(screen.getByLabelText("Morning dose quantity"));
    await user.type(screen.getByLabelText("Morning dose quantity"), "2");
    await user.click(screen.getByRole("button", { name: "Save medicine" }));

    await waitFor(() => {
      expect(updatePatientMedicationMock).toHaveBeenCalledWith(20, 1, {
        medication: 10,
        dose_instructions: "Private dose directions",
        quantity_morning: 2,
        quantity_lunchtime: 0,
        quantity_evening: 0,
        quantity_bedtime: 1,
        start_date: "2026-06-01",
        colour: "Blue",
        shape: "Round",
      });
    });
  });

  it("creates from the selected Bedtime slot with only the Bedtime dose set", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Bedtime tray cell"));
    await user.click(screen.getByRole("button", { name: "Add another medicine" }));
    await user.type(screen.getByLabelText("Medicine"), "Para");
    await user.click(
      await screen.findByRole("option", {
        name: /Paracetamol 500mg tablets/i,
      }),
    );
    await user.clear(screen.getByLabelText("Bedtime dose quantity"));
    await user.type(screen.getByLabelText("Bedtime dose quantity"), "2");
    await user.type(screen.getByLabelText("Dose instructions"), "Take at night");
    await user.type(screen.getByLabelText("Colour"), "White");
    await user.type(screen.getByLabelText("Shape"), "Round");
    await user.type(screen.getByLabelText("Start date"), "2026-06-29");
    await user.click(screen.getByRole("button", { name: "Save medicine" }));

    await waitFor(() => {
      expect(createPatientMedicationMock).toHaveBeenCalledWith(20, {
        catalogue_product: 210,
        dose_instructions: "Take at night",
        quantity_morning: 0,
        quantity_lunchtime: 0,
        quantity_evening: 0,
        quantity_bedtime: 2,
        start_date: "2026-06-29",
        colour: "White",
        shape: "Round",
      });
    });
  });

  it("keeps advanced manual entry available through the old form", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Advanced manual entry" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Add medication" }),
    ).toBeInTheDocument();
  });

  it("uses safe wording in the tray builder", async () => {
    renderDosette();

    const traySection = (await screen.findByText("MDS tray builder")).closest(
      "section",
    );
    expect(traySection).not.toBeNull();
    for (const phrase of [
      "AI decided",
      "guaranteed",
      "clinically recommended",
      "automatic ordering",
      "automatic transfer",
      "automatic cycle creation",
      "automatic dispensing",
      "NHS integration",
      "NCRS",
      "compliance proof",
    ]) {
      expect(
        within(traySection as HTMLElement).queryByText(new RegExp(phrase, "i")),
      ).toBeNull();
    }
  });

  it("renders cycles", async () => {
    renderDosette();

    const weeklyCycle = await screen.findByRole("article", {
      name: "Cycle MDS-2026-W26",
    });
    expect(
      within(weeklyCycle).getByText(
        "SUT-P1 · 1-week supply · 22 Jun 2026 - 28 Jun 2026",
      ),
    ).toBeInTheDocument();
    expect(within(weeklyCycle).getByText("MDS-2026-W26")).toBeInTheDocument();
    expect(within(weeklyCycle).getByText("1-week supply")).toBeInTheDocument();
    expect(within(weeklyCycle).getByText("Upcoming")).toBeInTheDocument();

    const fourWeekCycle = screen.getByRole("article", {
      name: "Cycle MDS-2026-FW07",
    });
    expect(within(fourWeekCycle).getByText("4-week supply")).toBeInTheDocument();
    expect(within(fourWeekCycle).getAllByText("Prepared").length).toBeGreaterThan(
      0,
    );
  });

  it("renders the status section above the tray builder", async () => {
    renderDosette();

    const statusSection = await screen.findByLabelText("Dosette status overview");
    const trayBuilder = await screen.findByRole("table", {
      name: "MDS tray builder",
    });

    expect(
      statusSection.compareDocumentPosition(trayBuilder) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(statusSection).getByText("Current status")).toBeInTheDocument();
    expect(within(statusSection).getAllByText("Ready to prepare").length).toBeGreaterThan(
      0,
    );
    expect(within(statusSection).getByText("MDS-2026-W26")).toBeInTheDocument();
    expect(
      within(statusSection).getAllByText("Stock deducted").length,
    ).toBeGreaterThan(0);
  });

  it("renders upcoming predicted cycle periods without creating cycles", async () => {
    renderDosette();

    expect(await screen.findByText("Upcoming cycle plan")).toBeInTheDocument();
    const planSection = screen.getByLabelText("Upcoming cycle plan");
    expect(
      within(planSection).getByText(
        "Predicted dates only. Human review required; create each cycle when ready.",
      ),
    ).toBeInTheDocument();
    expect(
      within(planSection).getByText("29 Jun 2026 - 26 Jul 2026"),
    ).toBeInTheDocument();
    expect(
      within(planSection).getByText("27 Jul 2026 - 23 Aug 2026"),
    ).toBeInTheDocument();
    expect(createDosetteCycleMock).not.toHaveBeenCalled();
  });

  it("renders a printable dosette tray sheet without patient demographics", async () => {
    const user = userEvent.setup();
    listDosetteCyclesMock.mockResolvedValueOnce([
      makeCycle({
        status: "PREPARED",
        stock_deducted: true,
        deducted_at: "2026-06-25T11:30:00Z",
        prepared_by_email: "pharmacist@example.com",
        prepared_at: "2026-06-25T09:30:00Z",
        checked_by_email: "checker@example.com",
        checked_at: "2026-06-25T10:15:00Z",
      }),
    ]);
    renderDosette();

    await generatePickingList(user);
    expect(
      await screen.findByText(DEFAULT_PICKING_LIST_HEADING),
    ).toBeInTheDocument();
    expect(screen.getAllByText("MDS-2026-W26").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Print Dosette sheet" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Print Dosette sheet",
    });
    expect(within(dialog).getByLabelText("Dosette tray sheet")).toBeInTheDocument();
    expect(within(dialog).getByText("Dosette tray sheet")).toBeInTheDocument();
    expect(within(dialog).getByText("JMW Sutton")).toBeInTheDocument();
    expect(within(dialog).getByText("SUT-P1")).toBeInTheDocument();
    expect(within(dialog).getByText("MDS-2026-W26")).toBeInTheDocument();
    expect(
      within(dialog).getByText("22 Jun 2026 - 28 Jun 2026"),
    ).toBeInTheDocument();
    for (const day of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]) {
      expect(within(dialog).getByText(day)).toBeInTheDocument();
    }
    for (const doseTime of ["Morning", "Lunchtime", "Evening", "Bedtime"]) {
      expect(within(dialog).getByText(doseTime)).toBeInTheDocument();
    }

    const mondayMorning = within(dialog).getByLabelText("Monday Morning");
    const mondayMorningAmlodipine = within(mondayMorning).getByLabelText(
      "Amlodipine 5 mg Monday Morning",
    );
    expect(
      within(mondayMorningAmlodipine).getByText("Amlodipine 5 mg"),
    ).toBeInTheDocument();
    expect(
      within(mondayMorningAmlodipine).getByText("1 tablet"),
    ).toBeInTheDocument();
    expect(
      within(mondayMorningAmlodipine).getByText("Blue · Round"),
    ).toBeInTheDocument();

    const mondayLunchtime = within(dialog).getByLabelText("Monday Lunchtime");
    expect(within(mondayLunchtime).queryByText("Amlodipine 5 mg")).toBeNull();
    expect(within(mondayLunchtime).queryByText("Metformin 500 mg")).toBeNull();
    expect(within(mondayLunchtime).getByText("-")).toBeInTheDocument();

    const mondayEvening = within(dialog).getByLabelText("Monday Evening");
    expect(
      within(mondayEvening).getByLabelText("Metformin 500 mg Monday Evening"),
    ).toBeInTheDocument();
    expect(within(mondayEvening).queryByText("Amlodipine 5 mg")).toBeNull();

    const mondayBedtime = within(dialog).getByLabelText("Monday Bedtime");
    expect(
      within(mondayBedtime).getByLabelText("Amlodipine 5 mg Monday Bedtime"),
    ).toBeInTheDocument();
    expect(within(mondayBedtime).queryByText("Metformin 500 mg")).toBeNull();

    expect(within(dialog).queryByText("Private dose directions")).toBeNull();
    expect(within(dialog).queryByText("Inactive line")).toBeNull();
    expect(within(dialog).queryByText("Demo PatientOne")).toBeNull();
    expect(within(dialog).queryByText("01 Jan 1980")).toBeNull();
    expect(within(dialog).queryByText("SM1 1AA")).toBeNull();
    expect(within(dialog).queryByText("020 0000 0001")).toBeNull();
    expect(within(dialog).queryByText("1 Demo Street, Sutton")).toBeNull();
    expect(within(dialog).queryByText("Printed date")).toBeNull();
    expect(
      within(dialog).getByText(
        "Pharmacy Dosette preparation support. Human review required.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/^Printed /)).toBeInTheDocument();
  });

  it("prints the dosette sheet from the preview", async () => {
    const user = userEvent.setup();
    const originalPrint = window.print;
    const printMock = vi.fn();
    Object.defineProperty(window, "print", {
      configurable: true,
      value: printMock,
    });
    renderDosette();

    await user.click(await screen.findByRole("button", { name: "Print Dosette sheet" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Print Dosette sheet",
    });
    await user.click(within(dialog).getByRole("button", { name: "Print sheet" }));

    expect(printMock).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, "print", {
      configurable: true,
      value: originalPrint,
    });
  });

  it("generating a picking list renders stock-pick essentials without backend mutation", async () => {
    const user = userEvent.setup();
    renderDosette();

    expect(
      await screen.findByRole("button", { name: "Generate picking list" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_PICKING_LIST_HEADING)).toBeNull();
    expect(getPickingListMock).not.toHaveBeenCalled();
    expect(getStockPreviewMock).not.toHaveBeenCalled();

    await generatePickingList(user);

    expect(getPickingListMock).toHaveBeenCalledWith(20, 40);
    expect(
      await screen.findByText(DEFAULT_PICKING_LIST_HEADING),
    ).toBeInTheDocument();
    const pickingList = screen.getByRole("region", {
      name: "Picking list",
    });
    expect(pickingList).toBeInTheDocument();
    expect(
      within(pickingList).getByText(
        "Use this list to gather stock for the selected Dosette cycle. Review before preparation.",
      ),
    ).toBeInTheDocument();
    expect(within(pickingList).getByText("Items to pick")).toBeInTheDocument();
    expect(
      within(pickingList).getByText("Quantity from current picking data"),
    ).toBeInTheDocument();
    expect(within(pickingList).getByText("SUT-P1")).toBeInTheDocument();

    const amlodipineItem = within(pickingList).getByRole("article", {
      name: "Picking item Amlodipine",
    });
    const metforminItem = within(pickingList).getByRole("article", {
      name: "Picking item Metformin",
    });
    expect(within(amlodipineItem).getByText("5 mg / TABLET")).toBeInTheDocument();
    expect(
      within(amlodipineItem).getByText("Required quantity"),
    ).toBeInTheDocument();
    expect(within(amlodipineItem).getByText("2 total daily")).toBeInTheDocument();
    expect(
      within(amlodipineItem).getByText("From current picking data."),
    ).toBeInTheDocument();
    expect(within(metforminItem).getByText("500 mg / TABLET")).toBeInTheDocument();
    expect(within(metforminItem).getByText("2 total daily")).toBeInTheDocument();
    expect(
      within(pickingList).queryByText("AM"),
    ).not.toBeInTheDocument();
    expect(within(pickingList).queryByText("Lunch")).not.toBeInTheDocument();
    expect(within(pickingList).queryByText("Morning")).not.toBeInTheDocument();
    expect(within(pickingList).queryByText("Lunchtime")).not.toBeInTheDocument();
    expect(within(pickingList).queryByText("Evening")).not.toBeInTheDocument();
    expect(within(pickingList).queryByText("Bedtime")).not.toBeInTheDocument();
    expect(
      within(pickingList).queryByText("Private dose directions"),
    ).not.toBeInTheDocument();
    expect(
      within(pickingList).queryByText("dose_instructions"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "MDS tray builder" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Stock availability" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Print Dosette sheet" }),
    ).toBeInTheDocument();
    expect(createDosetteCycleMock).not.toHaveBeenCalled();
    expect(prepareDosetteCycleMock).not.toHaveBeenCalled();
    expect(cancelDosetteCycleMock).not.toHaveBeenCalled();
    expect(deductDosetteStockMock).not.toHaveBeenCalled();
  });

  it("switching cycle resets the generated picking-list view", async () => {
    const user = userEvent.setup();
    renderDosette();

    await generatePickingList(user);
    expect(
      await screen.findByText(DEFAULT_PICKING_LIST_HEADING),
    ).toBeInTheDocument();

    const selectButtons = await screen.findAllByRole("button", {
      name: "Select cycle",
    });
    await user.click(selectButtons[1]);

    expect(screen.queryByText(DEFAULT_PICKING_LIST_HEADING)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Generate picking list" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Generate picking list" }),
    );

    await waitFor(() => {
      expect(getPickingListMock).toHaveBeenCalledWith(20, 41);
    });
  });

  it("generating a picking list renders stock availability values and suggested batches", async () => {
    const user = userEvent.setup();
    renderDosette();

    await generatePickingList(user);

    expect(getStockPreviewMock).toHaveBeenCalledWith(20, 40);
    expect(
      await screen.findByRole("heading", { name: "Stock availability" }),
    ).toBeInTheDocument();
    const stockSection = screen
      .getByRole("heading", { name: "Stock availability" })
      .closest("section");
    expect(stockSection).not.toBeNull();

    expect(
      within(stockSection as HTMLElement).getByText(
        "Check available quantity, shortages, and suggested batch expiry before gathering stock.",
      ),
    ).toBeInTheDocument();
    expect(
      within(stockSection as HTMLElement).getAllByText("Short / needs review")
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(stockSection as HTMLElement).getAllByText("6").length,
    ).toBeGreaterThan(0);
    expect(
      within(stockSection as HTMLElement).getAllByText("9").length,
    ).toBeGreaterThan(0);

    const amlodipineCard = within(stockSection as HTMLElement).getByRole(
      "article",
      { name: "Stock availability Amlodipine" },
    );
    const metforminCard = within(stockSection as HTMLElement).getByRole("article", {
      name: "Stock availability Metformin",
    });

    expect(within(amlodipineCard).getByText("5 mg / TABLET")).toBeInTheDocument();
    expect(within(amlodipineCard).getByText("Stock available")).toBeInTheDocument();
    expect(within(amlodipineCard).getByText("Required quantity")).toBeInTheDocument();
    expect(within(amlodipineCard).getByText("2")).toBeInTheDocument();
    expect(within(amlodipineCard).getByText("Available quantity")).toBeInTheDocument();
    expect(within(amlodipineCard).getByText("8")).toBeInTheDocument();
    expect(within(amlodipineCard).getByText("No shortage shown.")).toBeInTheDocument();
    expect(
      within(amlodipineCard).getByText("Suggested batch/expiry"),
    ).toBeInTheDocument();
    expect(within(amlodipineCard).getByText("AML-FEFO-1")).toBeInTheDocument();
    expect(
      within(amlodipineCard).getByText("10 Jul 2026 - pick 2"),
    ).toBeInTheDocument();
    expect(within(amlodipineCard).getByText("8 available")).toBeInTheDocument();

    expect(within(metforminCard).getByText("500 mg / TABLET")).toBeInTheDocument();
    expect(within(metforminCard).getByText("Short")).toBeInTheDocument();
    expect(within(metforminCard).getByText("4")).toBeInTheDocument();
    expect(within(metforminCard).getByText("1")).toBeInTheDocument();
    expect(within(metforminCard).getByText("3")).toBeInTheDocument();
    expect(
      within(metforminCard).getByText("Review before picking."),
    ).toBeInTheDocument();
    expect(within(metforminCard).getByText("MET-FEFO-1")).toBeInTheDocument();
    expect(
      within(metforminCard).getByText("20 Jul 2026 - pick 1"),
    ).toBeInTheDocument();
    expect(within(metforminCard).getByText("1 available")).toBeInTheDocument();
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

    expect(await screen.findByText("MDS tray builder")).toBeInTheDocument();
    const emptyTray = screen.getByRole("table", { name: "MDS tray builder" });
    expect(within(emptyTray).getAllByText("Add medicine").length).toBeGreaterThan(
      0,
    );
    expect(await screen.findByText("No dosette cycles yet.")).toBeInTheDocument();
  });

  it("handles stock preview loading error and empty states", async () => {
    const user = userEvent.setup();
    getStockPreviewMock.mockReturnValueOnce(new Promise(() => undefined));
    const loadingRender = renderDosette();

    await generatePickingList(user);
    expect(await screen.findByText("Loading stock availability...")).toBeInTheDocument();
    loadingRender.unmount();

    getStockPreviewMock.mockRejectedValueOnce(new Error("No stock preview"));
    const errorRender = renderDosette();

    await generatePickingList(user);
    expect(
      await screen.findByText("Could not load stock availability."),
    ).toBeInTheDocument();
    errorRender.unmount();

    getStockPreviewMock.mockResolvedValueOnce(makeStockPreview({ medications: [] }));
    renderDosette();

    await generatePickingList(user);
    expect(
      await screen.findByText("No active medication lines to preview."),
    ).toBeInTheDocument();
  });

  it("shows medication management controls with blister manage", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    expect(
      screen.getByRole("button", { name: "Advanced manual entry" }),
    ).toBeInTheDocument();
    await user.click(within(tray).getByLabelText("Monday Morning tray cell"));
    const editor = screen.getByRole("region", { name: "Inline medicine editor" });
    expect(
      within(editor).getByRole("button", { name: "Add another medicine" }),
    ).toBeInTheDocument();
    expect(
      within(editor).getAllByRole("button", { name: "Edit medicine" }),
    ).toHaveLength(2);
    expect(
      within(editor).getAllByRole("button", { name: "Discontinue" }),
    ).toHaveLength(2);
  });

  it("hides medication management controls with only blister view", async () => {
    renderDosette();

    expect((await screen.findAllByText("Amlodipine")).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Advanced manual entry" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Monday Morning tray cell" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit medicine" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Discontinue" })).toBeNull();
  });

  it("saves medication appearance updates through the existing appearance control", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.mark_status": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Morning tray cell"));
    const editor = screen.getByRole("region", { name: "Inline medicine editor" });
    const amlodipineCard = within(editor).getByRole("article", {
      name: "Medicine in Morning Amlodipine",
    });
    await user.click(within(amlodipineCard).getByRole("button", { name: "Appearance" }));

    const dialog = screen.getByRole("dialog", { name: "Label appearance" });
    await user.clear(within(dialog).getByLabelText("Colour"));
    await user.type(within(dialog).getByLabelText("Colour"), "White");
    await user.clear(within(dialog).getByLabelText("Shape"));
    await user.type(within(dialog).getByLabelText("Shape"), "Oval");
    await user.click(within(dialog).getByRole("button", { name: "Save appearance" }));

    await waitFor(() => {
      expect(updateMedicationAppearanceMock).toHaveBeenCalledWith(20, 1, {
        colour: "White",
        shape: "Oval",
      });
    });
  });

  it("discontinue confirmation calls API and refetches medication picking-list and stock-preview data", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    await generatePickingList(user);
    expect(await screen.findByText(DEFAULT_PICKING_LIST_HEADING)).toBeInTheDocument();
    const medicationCallsBefore = listPatientMedicationsMock.mock.calls.length;
    const pickingCallsBefore = getPickingListMock.mock.calls.length;
    const stockPreviewCallsBefore = getStockPreviewMock.mock.calls.length;

    const tray = screen.getByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Morning tray cell"));
    const editor = screen.getByRole("region", { name: "Inline medicine editor" });
    const amlodipineCard = within(editor).getByRole("article", {
      name: "Medicine in Morning Amlodipine",
    });
    await user.click(
      within(amlodipineCard).getByRole("button", { name: "Discontinue" }),
    );
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

    expect((await screen.findAllByText("MDS-2026-W26")).length).toBeGreaterThan(0);
    const cyclesSection = screen.getByText("Dosette status").closest("section");
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

    expect((await screen.findAllByText("MDS-2026-W26")).length).toBeGreaterThan(0);
    const cyclesSection = screen.getByText("Dosette status").closest("section");
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

    expect((await screen.findAllByText("MDS-2026-W26")).length).toBeGreaterThan(0);
    const cyclesSection = screen.getByText("Dosette status").closest("section");
    expect(cyclesSection).not.toBeNull();
    expect(
      within(cyclesSection as HTMLElement).getAllByRole("button", {
        name: "Prepare",
      }),
    ).toHaveLength(1);

    const draftCycle = getCycleArticle("MDS-2026-W26");
    const preparedCycle = getCycleArticle("MDS-2026-FW07");
    expect(
      within(draftCycle).getByRole("button", { name: "Prepare" }),
    ).toBeInTheDocument();
    expect(
      within(preparedCycle).queryByRole("button", {
        name: "Prepare",
      }),
    ).toBeNull();
  });

  it("hides prepare without mark-prepared permission", async () => {
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect((await screen.findAllByText("MDS-2026-W26")).length).toBeGreaterThan(0);
    const cyclesSection = screen.getByText("Dosette status").closest("section");
    expect(cyclesSection).not.toBeNull();
    expect(
      within(cyclesSection as HTMLElement).queryByRole("button", {
        name: "Prepare",
      }),
    ).toBeNull();
  });

  it("shows deduct stock only with permission for prepared non-deducted cycles", async () => {
    listDosetteCyclesMock.mockResolvedValueOnce([
      makeCycle({ id: 40, reference: "MDS-2026-DRAFT", status: "DRAFT" }),
      makeCycle({
        id: 41,
        reference: "MDS-2026-PREPARED",
        status: "PREPARED",
      }),
      makeCycle({
        id: 42,
        reference: "MDS-2026-DEDUCTED",
        status: "PREPARED",
        stock_deducted: true,
        deducted_at: "2026-06-20T09:30:00Z",
      }),
    ]);
    const allowedRender = renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.deduct": true }),
    );

    expect(
      (await screen.findAllByText("MDS-2026-DEDUCTED")).length,
    ).toBeGreaterThan(0);
    const draftCycle = getCycleArticle("MDS-2026-DRAFT");
    const preparedCycle = getCycleArticle("MDS-2026-PREPARED");
    const deductedCycle = getCycleArticle("MDS-2026-DEDUCTED");
    expect(
      within(preparedCycle).getByRole("button", {
        name: "Deduct stock",
      }),
    ).toBeInTheDocument();
    expect(
      within(draftCycle).queryByRole("button", {
        name: "Deduct stock",
      }),
    ).toBeNull();
    expect(
      within(deductedCycle).queryByRole("button", {
        name: "Deduct stock",
      }),
    ).toBeNull();
    allowedRender.unmount();

    listDosetteCyclesMock.mockResolvedValueOnce([
      makeCycle({ status: "PREPARED" }),
    ]);
    const viewOnlyRender = renderDosette();

    expect((await screen.findAllByText("MDS-2026-W26")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Deduct stock" })).toBeNull();
    viewOnlyRender.unmount();
  });

  it("deduct stock confirmation calls API and invalidates dosette and inventory stock data", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.deduct": true }),
      queryClient,
    );

    expect((await screen.findAllByText("MDS-2026-FW07")).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Deduct stock" }));
    expect(
      screen.getByRole("heading", { name: "Deduct stock for this cycle?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This will permanently reduce inventory using FEFO allocation. It cannot be undone in the current version.",
      ),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Deduct stock",
      }),
    );

    await waitFor(() => {
      expect(deductDosetteStockMock).toHaveBeenCalledWith(20, 41);
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["dosette", "cycles", 20],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["dosette", "picking-list", 20],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["dosette", "stock-preview", 20],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["stock-items"],
      });
    });
  });

  it("renders shortage errors when stock deduction fails", async () => {
    const user = userEvent.setup();
    deductDosetteStockMock.mockRejectedValueOnce(
      new ApiError(400, {
        detail: "Insufficient stock to deduct for this cycle.",
        shortages: [
          {
            medication_id: 10,
            medication_name: "Amlodipine",
            required_quantity: 14,
            available_quantity: 5,
            shortage_quantity: 9,
          },
        ],
      }),
    );
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.deduct": true }),
    );

    await user.click(await screen.findByRole("button", { name: "Deduct stock" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Deduct stock",
      }),
    );

    expect(
      await screen.findByText("Insufficient stock to deduct for this cycle."),
    ).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Amlodipine")).toBeInTheDocument();
    expect(within(dialog).getByText("14")).toBeInTheDocument();
    expect(within(dialog).getByText("5")).toBeInTheDocument();
    expect(within(dialog).getByText("9")).toBeInTheDocument();
  });

  it("renders already deducted errors when stock deduction conflicts", async () => {
    const user = userEvent.setup();
    deductDosetteStockMock.mockRejectedValueOnce(
      new ApiError(409, {
        detail: "Stock has already been deducted for this cycle.",
        deducted_at: "2026-06-20T09:30:00Z",
      }),
    );
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.deduct": true }),
    );

    await user.click(await screen.findByRole("button", { name: "Deduct stock" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Deduct stock",
      }),
    );

    expect(
      await screen.findByText("Stock has already been deducted for this cycle."),
    ).toBeInTheDocument();
    expect(screen.getByText("Deducted at 20 Jun 2026")).toBeInTheDocument();
  });

  it("shows stock deducted badge and hides cancel for deducted cycles", async () => {
    listDosetteCyclesMock.mockResolvedValueOnce([
      makeCycle({
        id: 41,
        reference: "MDS-2026-DEDUCTED",
        status: "PREPARED",
        stock_deducted: true,
        deducted_at: "2026-06-20T09:30:00Z",
      }),
    ]);
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true, "blister.deduct": true }),
    );

    expect(
      (await screen.findAllByText("MDS-2026-DEDUCTED")).length,
    ).toBeGreaterThan(0);
    const deductedCycle = getCycleArticle("MDS-2026-DEDUCTED");
    expect(within(deductedCycle).getByText("Stock deducted")).toBeInTheDocument();
    expect(
      within(deductedCycle).queryByRole("button", {
        name: "Cancel",
      }),
    ).toBeNull();
  });

  it("does not render reversal or undo controls for deducted cycles", async () => {
    listDosetteCyclesMock.mockResolvedValueOnce([
      makeCycle({
        status: "PREPARED",
        stock_deducted: true,
        deducted_at: "2026-06-20T09:30:00Z",
      }),
    ]);
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true, "blister.deduct": true }),
    );

    expect((await screen.findAllByText("Stock deducted")).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole("button", { name: /reverse|undo/i })).toBeNull();
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

    expect(
      (await screen.findAllByText("MDS-2026-COMPLETED")).length,
    ).toBeGreaterThan(0);
    const cyclesSection = screen.getByText("Dosette status").closest("section");
    expect(cyclesSection).not.toBeNull();
    expect(
      within(cyclesSection as HTMLElement).getAllByRole("button", {
        name: "Cancel",
      }),
    ).toHaveLength(2);
    expect(
      within(getCycleArticle("MDS-2026-CANCELLED")).queryByRole("button", {
        name: "Cancel",
      }),
    ).toBeNull();
    expect(
      within(getCycleArticle("MDS-2026-COMPLETED")).queryByRole("button", {
        name: "Cancel",
      }),
    ).toBeNull();
  });

  it("prepare confirmation calls API and refetches cycles picking-list and stock-preview data", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.mark_prepared": true }),
    );

    await generatePickingList(user);
    expect(await screen.findByText(DEFAULT_PICKING_LIST_HEADING)).toBeInTheDocument();
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

    await generatePickingList(user);
    expect(await screen.findByText(DEFAULT_PICKING_LIST_HEADING)).toBeInTheDocument();
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

    expect((await screen.findAllByText("MDS-2026-W26")).length).toBeGreaterThan(0);
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

    expect((await screen.findAllByText("Amlodipine")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /prepare/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
    await generatePickingList(userEvent.setup());
    expect(await screen.findByText(DEFAULT_PICKING_LIST_HEADING)).toBeInTheDocument();
    const pickingList = screen.getByText(DEFAULT_PICKING_LIST_HEADING).closest(
      "section",
    );
    expect(pickingList).not.toBeNull();
    expect(
      within(pickingList as HTMLElement).queryByText("Private dose directions"),
    ).toBeNull();
    expect(within(pickingList as HTMLElement).queryByText("dose_instructions")).toBeNull();
  });
});
