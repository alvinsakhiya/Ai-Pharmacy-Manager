import { Route, Routes } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type {
  DosetteCycle,
  PatientMedicationLine,
} from "../dosette/dosetteApi";
import * as dosetteApi from "../dosette/dosetteApi";
import { PatientDetailScreen } from "./PatientDetailScreen";
import type { Patient } from "./patientApi";
import * as patientApi from "./patientApi";

vi.mock("./patientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patientApi")>();
  return {
    ...actual,
    listPatients: vi.fn(),
    getPatient: vi.fn(),
    listPatientNotes: vi.fn(),
  };
});

vi.mock("../dosette/dosetteApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../dosette/dosetteApi")>();
  return {
    ...actual,
    listPatientMedications: vi.fn(),
    listDosetteCycles: vi.fn(),
  };
});

const getPatientMock = vi.mocked(patientApi.getPatient);
const listPatientNotesMock = vi.mocked(patientApi.listPatientNotes);
const listPatientMedicationsMock = vi.mocked(dosetteApi.listPatientMedications);
const listDosetteCyclesMock = vi.mocked(dosetteApi.listDosetteCycles);

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 20,
    pharmacy: 1,
    patient_reference: "SUT-P1",
    first_name: "Alice",
    last_name: "Sutton",
    date_of_birth: "1980-01-01",
    address: "1 Demo Street, Sutton",
    postcode: "SM1 1AA",
    phone: "020 0000 0001",
    notes: "Fictional patient note",
    collection_method: "DELIVERY",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function makeMedicationLine(
  overrides: Partial<PatientMedicationLine> = {},
): PatientMedicationLine {
  return {
    id: 1,
    medication: 10,
    medication_name: "Amlodipine",
    dose_instructions: "Take one twice daily",
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
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-20T09:15:00Z",
    ...overrides,
  };
}

function makeCycle(overrides: Partial<DosetteCycle> = {}): DosetteCycle {
  return {
    id: 40,
    period: null,
    week_number: null,
    reference: "MDS-2026-W26",
    patient_reference: "SUT-P1",
    display_label: "SUT-P1 · 1-week supply · 22 Jun 2026 - 28 Jun 2026",
    supply_period_label: "1-week supply",
    frequency: "WEEKLY",
    start_date: "2026-06-22",
    end_date: "2026-06-28",
    due_status: "upcoming",
    days_until_due: 10,
    is_due_soon: false,
    status: "PREPARED",
    stock_deducted: true,
    deducted_at: "2026-06-25T11:30:00Z",
    prepared_by_email: "pharmacist@example.com",
    prepared_at: "2026-06-25T09:30:00Z",
    checked_by_email: "checker@example.com",
    checked_at: "2026-06-25T10:15:00Z",
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-25T10:15:00Z",
    ...overrides,
  };
}

function patientAuth(permissions: Record<string, boolean> = {}) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "patient.view": true,
        ...permissions,
      },
      pharmacies: [
        { id: 1, name: "JMW Sutton" },
        { id: 2, name: "JMW Croydon" },
      ],
    }),
  });
}

function renderDetail(route = "/patients/20", auth = patientAuth()) {
  return renderWithProviders(
    <Routes>
      <Route element={<PatientDetailScreen />} path="/patients/:patientId" />
    </Routes>,
    { auth, route },
  );
}

describe("PatientDetailScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getPatientMock.mockResolvedValue(makePatient());
    listPatientNotesMock.mockResolvedValue([]);
    listPatientMedicationsMock.mockResolvedValue([]);
    listDosetteCyclesMock.mockResolvedValue([]);
  });

  it("loads the patient from the route parameter", async () => {
    renderDetail();

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(getPatientMock).toHaveBeenCalledWith(20);
  });

  it("renders patient demographics", async () => {
    renderDetail();

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getAllByText("SUT-P1").length).toBeGreaterThan(0);
    expect(screen.getByText("Patient ID")).toBeInTheDocument();
    expect(screen.getAllByText("JMW Sutton").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Delivery").length).toBeGreaterThan(0);
    expect(screen.getByText("Collection method")).toBeInTheDocument();
    expect(screen.getAllByText("01 Jan 1980").length).toBeGreaterThan(0);
    expect(screen.getByText("1 Demo Street, Sutton")).toBeInTheDocument();
    expect(screen.getAllByText("SM1 1AA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("020 0000 0001").length).toBeGreaterThan(0);
    expect(screen.getByText("Fictional patient note")).toBeInTheDocument();
  });

  it("links back to the patient list", async () => {
    renderDetail();

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to patients" })).toHaveAttribute(
      "href",
      "/patients",
    );
  });

  it("renders doctor and GP tab content", async () => {
    const user = userEvent.setup();
    getPatientMock.mockResolvedValue(
      makePatient({
        gp: {
          doctor_name: "Dr Demo",
          practice_name: "Sutton Practice",
          practice_address: "1 GP Road",
          practice_postcode: "GP1 1AA",
          practice_phone: "020 0000 0200",
          practice_email: "gp@example.test",
          updated_at: "2026-06-20T09:00:00Z",
        },
      }),
    );
    renderDetail();

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Doctor & GP" }));

    expect(screen.getByRole("heading", { name: "Doctor & GP" })).toBeInTheDocument();
    expect(screen.getByText("Dr Demo")).toBeInTheDocument();
    expect(screen.getByText("Sutton Practice")).toBeInTheDocument();
  });

  it("renders the redesigned medication history panel", async () => {
    const user = userEvent.setup();
    listPatientMedicationsMock.mockResolvedValue([
      makeMedicationLine(),
      makeMedicationLine({
        id: 2,
        medication: 11,
        medication_name: "Metformin",
        dose_instructions: "Stopped after pharmacist review",
        strength: "500 mg",
        quantity_morning: 0,
        quantity_bedtime: 0,
        colour: "",
        shape: "",
        is_active: false,
      }),
    ]);
    listDosetteCyclesMock.mockResolvedValue([makeCycle()]);

    renderDetail("/patients/20", patientAuth({ "blister.view": true }));

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Medication history" }));

    const panel = await screen.findByRole("region", {
      name: "Patient medication history",
    });
    expect(panel).toHaveClass("space-y-3");

    // Summary row uses existing operational history only.
    const summary = within(panel).getByLabelText("Medication history summary");
    expect(within(summary).getByText("Active medications")).toBeInTheDocument();
    expect(within(summary).getByText("Latest prepared")).toBeInTheDocument();
    expect(within(summary).getByText("Latest checked")).toBeInTheDocument();
    expect(within(summary).getByText("Latest stock deducted")).toBeInTheDocument();
    expect(within(summary).getByText("Dosette cycles")).toBeInTheDocument();
    expect(
      within(panel).getAllByText("25 Jun 2026, 09:30").length,
    ).toBeGreaterThan(0);
    expect(
      within(panel).getAllByText("25 Jun 2026, 10:15").length,
    ).toBeGreaterThan(0);
    expect(
      within(panel).getAllByText("25 Jun 2026, 11:30").length,
    ).toBeGreaterThan(0);

    const listbox = within(panel).getByRole("listbox", {
      name: "Medication items",
    });
    const amlodipine = within(listbox).getByRole("option", {
      name: /Amlodipine/,
    });
    const metformin = within(listbox).getByRole("option", {
      name: /Metformin/,
    });

    expect(amlodipine).toHaveAttribute("aria-selected", "true");
    expect(metformin).toHaveAttribute("aria-selected", "false");
    expect(within(amlodipine).getByText("5 mg - Tablet")).toBeInTheDocument();
    expect(within(amlodipine).getByText("Active")).toBeInTheDocument();
    expect(within(amlodipine).getAllByText("Stock deducted").length).toBeGreaterThan(
      0,
    );
    expect(within(amlodipine).getByText("Morning 1")).toBeInTheDocument();
    expect(within(amlodipine).getByText("Bedtime 1")).toBeInTheDocument();
    expect(within(amlodipine).getByText("Lunchtime 0")).toBeInTheDocument();
    expect(
      within(amlodipine).getByText("Take one twice daily"),
    ).toBeInTheDocument();
    expect(
      within(amlodipine).getByLabelText("Compact timing summary"),
    ).toBeInTheDocument();
    expect(within(amlodipine).getAllByText("Prepared").length).toBeGreaterThan(0);
    expect(within(amlodipine).getByText("Checked")).toBeInTheDocument();
    expect(within(amlodipine).getByText("Deducted")).toBeInTheDocument();
    expect(within(amlodipine).getAllByText("Stock deducted").length).toBeGreaterThan(
      0,
    );
    expect(
      within(amlodipine).getAllByText("25 Jun 2026, 11:30").length,
    ).toBeGreaterThan(0);
    expect(
      within(amlodipine).getByText("MDS-2026-W26 - Prepared"),
    ).toBeInTheDocument();
    expect(within(amlodipine).getByText("Blue · Round")).toBeInTheDocument();
    expect(within(amlodipine).getByText("01 Jun 2026")).toBeInTheDocument();
    expect(within(metformin).getByText("Discontinued")).toBeInTheDocument();

    // Selected medication detail tracks the active row (subtle accessible state).
    expect(
      within(panel).getByRole("heading", { level: 4, name: "Amlodipine" }),
    ).toBeInTheDocument();
    expect(within(panel).getByLabelText("Daily dose")).toBeInTheDocument();
    expect(
      within(panel).getByRole("heading", {
        level: 5,
        name: "Latest event timing",
      }),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Cycle context")).toBeInTheDocument();
    expect(within(panel).getByText("Prepared at")).toBeInTheDocument();
    expect(within(panel).getByText("Checked at")).toBeInTheDocument();
    expect(within(panel).getByText("Stock deducted at")).toBeInTheDocument();
    expect(within(panel).getByText("Recorded")).toBeInTheDocument();
    expect(
      within(panel).getAllByText("pharmacist@example.com", { exact: false })
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(panel).getAllByText("checker@example.com", { exact: false }).length,
    ).toBeGreaterThan(0);

    await user.click(metformin);
    expect(amlodipine).toHaveAttribute("aria-selected", "false");
    expect(metformin).toHaveAttribute("aria-selected", "true");
    expect(
      within(panel).getByRole("heading", { level: 4, name: "Metformin" }),
    ).toBeInTheDocument();

    // Search narrows the list without mutating data.
    await user.type(within(panel).getByLabelText("Search medications"), "metf");
    expect(
      within(listbox).queryByRole("option", { name: /Amlodipine/ }),
    ).toBeNull();
    expect(
      within(listbox).getByRole("option", { name: /Metformin/ }),
    ).toBeInTheDocument();
    await user.clear(within(panel).getByLabelText("Search medications"));

    // Status filter narrows the list.
    await user.selectOptions(
      within(panel).getByLabelText("Filter by status"),
      "active",
    );
    expect(
      within(listbox).getByRole("option", { name: /Amlodipine/ }),
    ).toBeInTheDocument();
    expect(
      within(listbox).queryByRole("option", { name: /Metformin/ }),
    ).toBeNull();

    // No patient PII leaks into the medication panel.
    for (const forbidden of [
      "01 Jan 1980",
      "SM1 1AA",
      "020 0000 0001",
      "1 Demo Street, Sutton",
      "NHS",
      "NCRS",
      "View patient NCRS",
    ]) {
      expect(within(panel).queryByText(forbidden)).toBeNull();
    }

    // Full pack-cycle history remains available below the panel.
    expect(screen.getByText("MDS / Dosette cycle history")).toBeInTheDocument();
    expect(screen.getByText("pharmacist@example.com")).toBeInTheDocument();
    expect(screen.getByText("checker@example.com")).toBeInTheDocument();
  });

  it("uses safe fallbacks and never shows draft cycle dates as events", async () => {
    const user = userEvent.setup();
    listPatientMedicationsMock.mockResolvedValue([
      makeMedicationLine({
        dose_instructions: "",
        quantity_morning: 0,
        quantity_lunchtime: 0,
        quantity_evening: 0,
        quantity_bedtime: 0,
        strength: "",
        form: "",
        colour: "",
        shape: "",
      }),
    ]);
    listDosetteCyclesMock.mockResolvedValue([
      makeCycle({
        id: 41,
        reference: "DRAFT-CYCLE",
        display_label: "SUT-P1 · 4-week supply · 01 Jul 2026 - 28 Jul 2026",
        status: "DRAFT",
        stock_deducted: false,
        deducted_at: null,
        prepared_by_email: null,
        prepared_at: null,
        checked_by_email: null,
        checked_at: null,
        start_date: "2026-07-01",
        end_date: "2026-07-28",
      }),
    ]);

    renderDetail("/patients/20", patientAuth({ "blister.view": true }));

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Medication history" }));

    const panel = await screen.findByRole("region", {
      name: "Patient medication history",
    });

    expect(
      within(panel).getAllByText("Strength/form not recorded").length,
    ).toBeGreaterThan(0);
    expect(
      within(panel).getAllByText("Dosage instructions not recorded.").length,
    ).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Morning 0").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Not recorded").length).toBeGreaterThan(0);
    expect(
      within(panel).getAllByText("DRAFT-CYCLE · Draft").length,
    ).toBeGreaterThan(0);

    // Draft / future cycle dates must never appear as dispensing events.
    expect(within(panel).queryByText("28 Jul 2026")).toBeNull();
    expect(within(panel).queryByText("01 Jul 2026")).toBeNull();
  });

  it("renders medication history empty state", async () => {
    const user = userEvent.setup();

    renderDetail("/patients/20", patientAuth({ "blister.view": true }));

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Medication history" }));

    expect(
      await screen.findByText("No medication history recorded yet."),
    ).toBeInTheDocument();
  });

  it("renders note history without write controls for read-only users", async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Notes" }));
    expect(screen.getByText("Note history")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /deactivate/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add note/i })).toBeNull();
  });

  it("shows dosette link for users with blister view", async () => {
    renderDetail("/patients/20", patientAuth({ "blister.view": true }));

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dosette / MDS" })).toHaveAttribute(
      "href",
      "/patients/20/dosette",
    );
  });

  it("hides dosette link without blister view", async () => {
    renderDetail();

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dosette / MDS" })).toBeNull();
  });

  it("shows not found or out-of-access error state", async () => {
    getPatientMock.mockRejectedValue(new Error("Not found"));

    renderDetail();

    expect(
      await screen.findByText("This patient was not found or is outside your access."),
    ).toBeInTheDocument();
  });
});
