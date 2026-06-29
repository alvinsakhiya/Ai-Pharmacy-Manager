import { Route, Routes } from "react-router-dom";
import type { QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
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
  DosettePeriod,
  PatientMedicationLine,
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
    listDosettePeriods: vi.fn(),
    getPickingList: vi.fn(),
    getStockPreview: vi.fn(),
    submitDosettePeriod: vi.fn(),
    markDosettePeriodCollected: vi.fn(),
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
const listDosettePeriodsMock = vi.mocked(dosetteApi.listDosettePeriods);
const submitDosettePeriodMock = vi.mocked(dosetteApi.submitDosettePeriod);
const markDosettePeriodCollectedMock = vi.mocked(
  dosetteApi.markDosettePeriodCollected,
);
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

function makePeriod(overrides: Partial<DosettePeriod> = {}): DosettePeriod {
  const period: DosettePeriod = {
    id: 70,
    patient_reference: "SUT-P1",
    start_date: "2026-06-29",
    end_date: "2026-07-26",
    status: "SUBMITTED",
    submitted_at: "2026-06-28T10:00:00Z",
    collected_on: null,
    next_due_date: null,
    reminder_date: null,
    cycles: [
      {
        id: 701,
        reference: "MDS-PERIOD-70-W1",
        week_number: 1,
        start_date: "2026-06-29",
        end_date: "2026-07-05",
        status: "DRAFT",
        stock_deducted: false,
      },
      {
        id: 702,
        reference: "MDS-PERIOD-70-W2",
        week_number: 2,
        start_date: "2026-07-06",
        end_date: "2026-07-12",
        status: "DRAFT",
        stock_deducted: false,
      },
      {
        id: 703,
        reference: "MDS-PERIOD-70-W3",
        week_number: 3,
        start_date: "2026-07-13",
        end_date: "2026-07-19",
        status: "DRAFT",
        stock_deducted: false,
      },
      {
        id: 704,
        reference: "MDS-PERIOD-70-W4",
        week_number: 4,
        start_date: "2026-07-20",
        end_date: "2026-07-26",
        status: "DRAFT",
        stock_deducted: false,
      },
    ],
    created_at: "2026-06-28T10:00:00Z",
    updated_at: "2026-06-28T10:00:00Z",
    ...overrides,
  };
  return {
    ...period,
    cycles: overrides.cycles ?? period.cycles,
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

function setViewportSize(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

function mockElementRect(
  element: Element,
  rect: { height: number; left: number; top: number; width: number },
) {
  const domRect = {
    bottom: rect.top + rect.height,
    height: rect.height,
    left: rect.left,
    right: rect.left + rect.width,
    top: rect.top,
    width: rect.width,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect;
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => domRect,
  });
}

describe("DosetteScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setViewportSize(1024, 768);
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
    listDosettePeriodsMock.mockResolvedValue([]);
    submitDosettePeriodMock.mockResolvedValue(makePeriod());
    markDosettePeriodCollectedMock.mockResolvedValue(
      makePeriod({
        status: "COLLECTED",
        collected_on: "2026-07-27",
        next_due_date: "2026-08-24",
        reminder_date: "2026-08-17",
      }),
    );
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

  it("renders the MDS tray builder with days dose-times and saved medicine particles", async () => {
    const user = userEvent.setup();
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
    expect(
      within(mondayMorning).getByLabelText("Monday Morning medicines"),
    ).toBeInTheDocument();
    const amlodipineParticle = within(mondayMorning).getByRole("button", {
      name: "Show Amlodipine details for Monday Morning, 1 tablet",
    });
    const metforminParticle = within(mondayMorning).getByRole("button", {
      name: "Show Metformin details for Monday Morning, 1 tablet",
    });
    expect(amlodipineParticle).toBeInTheDocument();
    expect(metforminParticle).toBeInTheDocument();
    expect(amlodipineParticle).toHaveAttribute("aria-expanded", "false");
    expect(within(mondayMorning).queryByText("5 mg / TABLET")).toBeNull();
    expect(within(mondayMorning).queryByText("500 mg / TABLET")).toBeNull();
    expect(within(mondayMorning).queryByText("Blue · Round")).toBeNull();

    setViewportSize(320, 240);
    mockElementRect(amlodipineParticle, {
      height: 56,
      left: 4,
      top: 40,
      width: 48,
    });
    act(() => {
      amlodipineParticle.focus();
    });
    let details = await screen.findByRole("status", {
      name: "Amlodipine details",
    });
    expect(amlodipineParticle).toHaveAttribute("aria-expanded", "true");
    expect(amlodipineParticle).toHaveAttribute(
      "aria-describedby",
      details.id,
    );
    expect(document.body).toContainElement(details);
    expect(mondayMorning).not.toContainElement(details);
    expect(details.closest('[role="table"]')).toBeNull();
    expect(details).toHaveAttribute("data-placement", "bottom");
    expect(details).toHaveClass("w-56");
    expect(details).toHaveClass("max-w-xs");
    expect(details).toHaveClass("fixed");
    expect(details).not.toHaveClass("absolute");
    expect(details).not.toHaveClass("w-full");
    expect(details).not.toHaveClass("left-2");
    expect(details).not.toHaveClass("right-2");
    expect(details).toHaveStyle({ left: "12px", top: "96px" });
    expect(metforminParticle).toBeVisible();
    act(() => {
      amlodipineParticle.blur();
    });
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Amlodipine details" })).toBeNull();
    });

    await user.hover(amlodipineParticle);
    details = await screen.findByRole("status", {
      name: "Amlodipine details",
    });
    expect(within(details).getByText("Amlodipine")).toBeInTheDocument();
    expect(within(details).getByText("5 mg / TABLET")).toBeInTheDocument();
    expect(within(details).getByText("Blue · Round")).toBeInTheDocument();
    expect(
      within(details).getByText("1 tablet"),
    ).toBeInTheDocument();
    expect(within(details).getByText("Active")).toBeInTheDocument();
    expect(metforminParticle).toBeVisible();
    await user.unhover(amlodipineParticle);
    await user.click(metforminParticle);
    expect(await screen.findByRole("status", { name: "Metformin details" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Amlodipine details" })).toBeNull();
    expect(metforminParticle).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Metformin details" })).toBeNull();
    });
    expect(metforminParticle).toHaveAttribute("aria-expanded", "false");

    await user.click(metforminParticle);
    expect(await screen.findByRole("status", { name: "Metformin details" })).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Metformin details" })).toBeNull();
    });

    const sundayBedtime = within(tray).getByLabelText("Sunday Bedtime tray cell");
    const sundayBedtimeParticle = within(sundayBedtime).getByRole("button", {
      name: "Show Amlodipine details for Sunday Bedtime, 1 tablet",
    });
    mockElementRect(sundayBedtimeParticle, {
      height: 40,
      left: 290,
      top: 210,
      width: 40,
    });
    await user.click(sundayBedtimeParticle);
    const sundayDetails = await screen.findByRole("status", {
      name: "Amlodipine details",
    });
    expect(sundayDetails).toHaveAttribute("data-placement", "top");
    expect(sundayDetails).toHaveStyle({ left: "84px", top: "70px" });
    expect(sundayDetails.closest('[role="table"]')).toBeNull();

    const mondayLunchtime = within(tray).getByLabelText(
      "Monday Lunchtime tray cell",
    );
    expect(within(mondayLunchtime).getByText("Add medicine")).toBeInTheDocument();
    expect(within(mondayLunchtime).queryByText("Amlodipine")).toBeNull();

    const tuesdayBedtime = within(tray).getByLabelText(
      "Tuesday Bedtime tray cell",
    );
    expect(
      within(tuesdayBedtime).getByRole("button", {
        name: "Show Amlodipine details for Tuesday Bedtime, 1 tablet",
      }),
    ).toBeInTheDocument();
    expect(
      within(tuesdayBedtime).queryByRole("button", {
        name: "Show Metformin details for Tuesday Bedtime, 1 tablet",
      }),
    ).toBeNull();
    expect(within(tray).queryByText("Inactive line")).toBeNull();
    expect(createDosetteCycleMock).not.toHaveBeenCalled();
    expect(prepareDosetteCycleMock).not.toHaveBeenCalled();
    expect(cancelDosetteCycleMock).not.toHaveBeenCalled();
    expect(deductDosetteStockMock).not.toHaveBeenCalled();
  });

  it("opens a tray medicine modal from a tray cell without an inline editor", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Morning tray cell"));

    expect(
      screen.queryByRole("region", { name: "Inline medicine editor" }),
    ).toBeNull();
    const dialog = screen.getByRole("dialog", { name: "Add medicine to tray" });
    expect(within(dialog).getByText("Selected tray cell")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Monday · Morning").length).toBeGreaterThan(
      0,
    );
    expect(within(dialog).getByText("Saved as Morning")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This schedule repeats across the cycle using saved dose slots. Review before preparation.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Medicines in this dose-time")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Add another medicine" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getAllByRole("button", { name: "Edit medicine" }),
    ).toHaveLength(2);
    expect(
      within(dialog).getByRole("button", { name: "Save medication" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
  });

  it("updates the selected Morning slot through the existing medication payload", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Morning tray cell"));
    const dialog = screen.getByRole("dialog", { name: "Add medicine to tray" });
    const amlodipineCard = within(dialog).getByRole("article", {
      name: "Medicine in Morning Amlodipine",
    });
    await user.click(within(amlodipineCard).getByRole("button", { name: "Edit medicine" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit tray medicine" });
    await user.clear(screen.getByLabelText("Morning dose quantity"));
    await user.type(screen.getByLabelText("Morning dose quantity"), "2");
    await user.click(within(editDialog).getByRole("button", { name: "Save medication" }));

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

  it("creates from the selected Lunchtime slot with only the Lunchtime dose set", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Lunchtime tray cell"));
    const dialog = screen.getByRole("dialog", { name: "Add medicine to tray" });
    expect(within(dialog).getAllByText("Monday · Lunchtime").length).toBeGreaterThan(
      0,
    );
    expect(within(dialog).getByText("Saved as Lunchtime")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Medicine"), "Para");
    await user.click(
      await within(dialog).findByRole("option", {
        name: /Paracetamol 500mg tablets/i,
      }),
    );
    expect(
      within(dialog).queryByRole("option", {
        name: /Paracetamol 500mg tablets/i,
      }),
    ).toBeNull();
    expect(within(dialog).getByLabelText("Selected catalogue product")).toHaveTextContent(
      "Paracetamol 500mg tablets",
    );
    await user.clear(within(dialog).getByLabelText("Lunchtime dose quantity"));
    await user.type(within(dialog).getByLabelText("Lunchtime dose quantity"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Save medication" }));

    await waitFor(() => {
      expect(createPatientMedicationMock).toHaveBeenCalledWith(20, {
        catalogue_product: 210,
        dose_instructions: "",
        quantity_morning: 0,
        quantity_lunchtime: 3,
        quantity_evening: 0,
        quantity_bedtime: 0,
        start_date: null,
        colour: "",
        shape: "",
      });
    });
  });

  it("creates from the selected Evening slot with only the Evening dose set", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const tray = await screen.findByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Evening tray cell"));
    const dialog = screen.getByRole("dialog", { name: "Add medicine to tray" });
    expect(within(dialog).getAllByText("Monday · Evening").length).toBeGreaterThan(
      0,
    );
    expect(within(dialog).getByText("Saved as Evening")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add another medicine" }));
    await user.type(within(dialog).getByLabelText("Medicine"), "Para");
    await user.click(
      await within(dialog).findByRole("option", {
        name: /Paracetamol 500mg tablets/i,
      }),
    );
    await user.clear(within(dialog).getByLabelText("Evening dose quantity"));
    await user.type(within(dialog).getByLabelText("Evening dose quantity"), "2");
    await user.click(within(dialog).getByRole("button", { name: "Save medication" }));

    await waitFor(() => {
      expect(createPatientMedicationMock).toHaveBeenCalledWith(20, {
        catalogue_product: 210,
        dose_instructions: "",
        quantity_morning: 0,
        quantity_lunchtime: 0,
        quantity_evening: 2,
        quantity_bedtime: 0,
        start_date: null,
        colour: "",
        shape: "",
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
    await user.click(within(tray).getByLabelText("Sunday Bedtime tray cell"));
    const dialog = screen.getByRole("dialog", { name: "Add medicine to tray" });
    expect(within(dialog).getAllByText("Sunday · Bedtime").length).toBeGreaterThan(
      0,
    );
    expect(within(dialog).getByText("Saved as Bedtime")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add another medicine" }));
    await user.type(within(dialog).getByLabelText("Medicine"), "Para");
    await user.click(
      await within(dialog).findByRole("option", {
        name: /Paracetamol 500mg tablets/i,
      }),
    );
    await user.clear(within(dialog).getByLabelText("Bedtime dose quantity"));
    await user.type(within(dialog).getByLabelText("Bedtime dose quantity"), "2");
    await user.type(within(dialog).getByLabelText("Dose instructions"), "Take at night");
    await user.type(within(dialog).getByLabelText("Colour"), "White");
    await user.type(within(dialog).getByLabelText("Shape"), "Round");
    await user.type(within(dialog).getByLabelText("Start date"), "2026-06-29");
    await user.click(within(dialog).getByRole("button", { name: "Save medication" }));

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

  it("uses safe wording in the patient dosette screen", async () => {
    renderDosette();

    expect(await screen.findByText("MDS tray builder")).toBeInTheDocument();
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
      expect(screen.queryByText(new RegExp(phrase, "i"))).toBeNull();
    }
    expect(
      screen.queryByRole("button", { name: /patient collected/i }),
    ).toBeNull();
    expect(screen.getAllByText(/four-week period/i).length).toBeGreaterThan(0);
  });

  it("submits the medication schedule and renders the four weekly period cycles", async () => {
    const user = userEvent.setup();
    const period = makePeriod();
    listDosettePeriodsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([period]);
    submitDosettePeriodMock.mockResolvedValueOnce(period);
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Submit medication schedule",
      }),
    );

    await waitFor(() => {
      expect(submitDosettePeriodMock).toHaveBeenCalledWith(20, {});
    });
    expect(createDosetteCycleMock).not.toHaveBeenCalled();
    expect(deductDosetteStockMock).not.toHaveBeenCalled();
    expect(prepareDosetteCycleMock).not.toHaveBeenCalled();

    const summary = await screen.findByText("Four-week cycles");
    expect(summary).toBeInTheDocument();
    for (const week of ["Week 1", "Week 2", "Week 3", "Week 4"]) {
      expect(screen.getByRole("article", { name: `${week} cycle` })).toBeInTheDocument();
    }
    expect(
      screen.getAllByText("29 Jun 2026 - 26 Jul 2026").length,
    ).toBeGreaterThan(0);
  });

  it("records Patient Collected and shows next due and prepare reminder dates", async () => {
    const user = userEvent.setup();
    const submittedPeriod = makePeriod();
    const collectedPeriod = makePeriod({
      status: "COLLECTED",
      collected_on: "2026-07-27",
      next_due_date: "2026-08-24",
      reminder_date: "2026-08-17",
    });
    listDosettePeriodsMock
      .mockResolvedValueOnce([submittedPeriod])
      .mockResolvedValueOnce([collectedPeriod]);
    markDosettePeriodCollectedMock.mockResolvedValueOnce(collectedPeriod);
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    const collectionDate = await screen.findByLabelText("Collection date");
    await user.clear(collectionDate);
    await user.type(collectionDate, "2026-06-28");
    await user.click(screen.getByRole("button", { name: "Patient Collected" }));

    await waitFor(() => {
      expect(markDosettePeriodCollectedMock).toHaveBeenCalledWith(20, 70, {
        collected_on: "2026-06-28",
      });
    });
    expect(await screen.findByText("27 Jul 2026")).toBeInTheDocument();
    expect(screen.getByText("24 Aug 2026")).toBeInTheDocument();
    expect(screen.getByText("17 Aug 2026")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Work Queue reminder appears seven days before the next due date.",
      ),
    ).toBeInTheDocument();
  });

  it("shows safe collection error copy when backend blocks collection", async () => {
    const user = userEvent.setup();
    listDosettePeriodsMock.mockResolvedValueOnce([makePeriod()]);
    markDosettePeriodCollectedMock.mockRejectedValueOnce(
      new ApiError(400, {
        detail: [
          "All four cycles must be checked and stock deducted before collection can be recorded.",
        ],
      }),
    );
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Patient Collected" }),
    );

    expect(
      await screen.findByText(
        "Collection can be recorded after the four-week period has been checked and stock deducted.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("PrivateFirst")).toBeNull();
    expect(screen.queryByText("PrivateLast")).toBeNull();
  });

  it("shows collected_on validation errors from Patient Collected", async () => {
    const user = userEvent.setup();
    listDosettePeriodsMock.mockResolvedValueOnce([makePeriod()]);
    markDosettePeriodCollectedMock.mockRejectedValueOnce(
      new ApiError(400, {
        collected_on: ["Collection date cannot be in the future."],
      }),
    );
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Patient Collected" }),
    );

    expect(
      await screen.findByText("Collection date cannot be in the future."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Collection can be recorded after the four-week period has been checked and stock deducted.",
      ),
    ).toBeNull();
    expect(screen.queryByText("PrivateFirst")).toBeNull();
    expect(screen.queryByText("PrivateLast")).toBeNull();
  });

  it("keeps the safe generic Patient Collected fallback when no safe field error is present", async () => {
    const user = userEvent.setup();
    listDosettePeriodsMock.mockResolvedValueOnce([makePeriod()]);
    markDosettePeriodCollectedMock.mockRejectedValueOnce(
      new ApiError(400, {
        non_field_errors: ["Unexpected collection validation."],
      }),
    );
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    await user.click(
      await screen.findByRole("button", { name: "Patient Collected" }),
    );

    expect(
      await screen.findByText(
        "Collection can be recorded after the four-week period has been checked and stock deducted.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Unexpected collection validation.")).toBeNull();
    expect(screen.queryByText("PrivateFirst")).toBeNull();
    expect(screen.queryByText("PrivateLast")).toBeNull();
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

  it("renders a simplified status panel above the tray builder", async () => {
    renderDosette();

    const statusSection = await screen.findByLabelText("Dosette status overview");
    const trayBuilder = await screen.findByRole("table", {
      name: "MDS tray builder",
    });

    expect(
      statusSection.compareDocumentPosition(trayBuilder) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(statusSection).getByText("Current stage")).toBeInTheDocument();
    expect(within(statusSection).getByText("Medicines added")).toBeInTheDocument();
    expect(
      within(statusSection).getByText("Prepare the tray, then mark as prepared."),
    ).toBeInTheDocument();
    expect(
      within(statusSection).getByText("Preparation progress"),
    ).toBeInTheDocument();
    expect(within(statusSection).getByText("Stock action")).toBeInTheDocument();
    expect(
      within(statusSection).getByText("Pharmacist check"),
    ).toBeInTheDocument();
    expect(
      within(statusSection).queryByText("Internal reference:"),
    ).toBeNull();

    const checklist = within(statusSection).getByRole("list", {
      name: "Dosette preparation checklist",
    });
    for (const step of ["Medicines", "Prepared", "Checked", "Stock deducted"]) {
      expect(within(checklist).getByText(step)).toBeInTheDocument();
    }
    expect(within(checklist).queryByText("Picking list")).toBeNull();
    expect(within(checklist).getByText("Current")).toBeInTheDocument();
    expect(
      within(checklist).getAllByText("Pending").length,
    ).toBeGreaterThan(0);
  });

  it("renders upcoming predicted cycle periods without creating cycles", async () => {
    renderDosette();

    expect(await screen.findByText("Upcoming cycle plan")).toBeInTheDocument();
    const planSection = screen.getByLabelText("Upcoming cycle plan");
    expect(
      within(planSection).getByText(
        "Predicted dates only. Human review required before any future period is submitted.",
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

    expect((await screen.findAllByText("MDS-2026-W26")).length).toBeGreaterThan(0);
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

  it("does not render the picking-list workflow on the Patient Dosette screen", async () => {
    const period = makePeriod();
    listDosettePeriodsMock.mockResolvedValueOnce([period]);
    renderDosette();

    expect(await screen.findByText("Dosette status")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "MDS tray builder" })).toBeInTheDocument();
    expect(screen.getByText("Four-week cycles")).toBeInTheDocument();
    for (const week of ["Week 1", "Week 2", "Week 3", "Week 4"]) {
      expect(screen.getByRole("article", { name: `${week} cycle` })).toBeInTheDocument();
    }

    expect(screen.queryByRole("region", { name: "Picking List workflow" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Picking list" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Generate picking list" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Stock availability" })).toBeNull();
    expect(screen.queryByText("Legacy cycles available")).toBeNull();
    expect(screen.queryByText("stock-pick view")).toBeNull();
    expect(screen.queryByRole("article", { name: "Picking item Amlodipine" })).toBeNull();
    expect(
      screen.queryByRole("article", { name: "Stock availability Amlodipine" }),
    ).toBeNull();
    expect(createDosetteCycleMock).not.toHaveBeenCalled();
    expect(prepareDosetteCycleMock).not.toHaveBeenCalled();
    expect(cancelDosetteCycleMock).not.toHaveBeenCalled();
    expect(deductDosetteStockMock).not.toHaveBeenCalled();
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
    expect(
      screen.getByText(
        "Four weekly cycles will appear after the medication schedule is submitted.",
      ),
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
    const editor = screen.getByRole("dialog", { name: "Add medicine to tray" });
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

    expect(
      await screen.findByRole("button", {
        name: "Show Amlodipine details for Monday Morning, 1 tablet",
      }),
    ).toBeInTheDocument();
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
    const editor = screen.getByRole("dialog", { name: "Add medicine to tray" });
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

  it("discontinue confirmation calls API and refetches medication data", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect(await screen.findByText("MDS tray builder")).toBeInTheDocument();
    const medicationCallsBefore = listPatientMedicationsMock.mock.calls.length;

    const tray = screen.getByRole("table", { name: "MDS tray builder" });
    await user.click(within(tray).getByLabelText("Monday Morning tray cell"));
    const editor = screen.getByRole("dialog", { name: "Add medicine to tray" });
    const amlodipineCard = within(editor).getByRole("article", {
      name: "Medicine in Morning Amlodipine",
    });
    await user.click(
      within(amlodipineCard).getByRole("button", { name: "Discontinue" }),
    );
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Discontinue medication line?" }),
      ).getByRole("button", {
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
    });
  });

  it("shows cycle add edit and cancel with blister manage", async () => {
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect((await screen.findAllByText("MDS-2026-W26")).length).toBeGreaterThan(0);
    const cyclesSection = screen.getByText("Advanced cycle tools").closest("section");
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
    const cyclesSection = screen.getByText("Advanced cycle tools").closest("section");
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
    const cyclesSection = screen.getByText("Advanced cycle tools").closest("section");
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
    const cyclesSection = screen.getByText("Advanced cycle tools").closest("section");
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
    const cyclesSection = screen.getByText("Advanced cycle tools").closest("section");
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

  it("prepare confirmation calls API and refetches cycles data", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.mark_prepared": true }),
    );

    expect(await screen.findByText("Advanced cycle tools")).toBeInTheDocument();
    const cycleCallsBefore = listDosetteCyclesMock.mock.calls.length;

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
    });
  });

  it("cancel confirmation calls API and refetches cycles data", async () => {
    const user = userEvent.setup();
    renderDosette(
      "/patients/20/dosette",
      dosetteAuth({ "blister.manage": true }),
    );

    expect(await screen.findByText("Advanced cycle tools")).toBeInTheDocument();
    const cycleCallsBefore = listDosetteCyclesMock.mock.calls.length;

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
    });
  });

  it("does not add checked completed stock mutation reservation deduction or label controls", async () => {
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

  it("does not render mutation controls for view-only users or private dose instructions outside details", async () => {
    listPatientMedicationsMock.mockResolvedValueOnce([
      makeLine({
        dose_instructions: "Private dose directions",
      }),
    ]);
    renderDosette();

    expect(
      await screen.findByRole("button", {
        name: "Show Amlodipine details for Monday Morning, 1 tablet",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /prepare/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Picking List workflow" }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Picking list" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Generate picking list" }),
    ).toBeNull();
    expect(screen.queryByRole("heading", { name: "Stock availability" })).toBeNull();
    expect(screen.queryByText("Private dose directions")).toBeNull();
    expect(screen.queryByText("dose_instructions")).toBeNull();
  });
});
