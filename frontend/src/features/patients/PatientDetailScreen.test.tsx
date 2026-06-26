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
    expect(screen.getByText("SUT-P1")).toBeInTheDocument();
    expect(screen.getByText("Patient ID")).toBeInTheDocument();
    expect(screen.getAllByText("JMW Sutton").length).toBeGreaterThan(0);
    expect(screen.getByText("01 Jan 1980")).toBeInTheDocument();
    expect(screen.getByText("1 Demo Street, Sutton")).toBeInTheDocument();
    expect(screen.getByText("SM1 1AA")).toBeInTheDocument();
    expect(screen.getByText("020 0000 0001")).toBeInTheDocument();
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

  it("renders improved medication history from dosette records", async () => {
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

    expect(await screen.findByText("Medication Items")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Dispensing and Dosette history shown from pharmacy records. Human review required.",
      ),
    ).toBeInTheDocument();
    for (const header of [
      "Description",
      "Price",
      "#",
      "Last Dispensed",
      "Qty Prescribed",
      "Dose",
    ]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }

    const medicationItems = screen.getByRole("region", {
      name: "Medication Items",
    });
    const listbox = within(medicationItems).getByRole("listbox", {
      name: "Medication Items",
    });
    const amlodipine = within(listbox).getByRole("option", {
      name: /Amlodipine/,
    });
    const metformin = within(listbox).getByRole("option", {
      name: /Metformin/,
    });

    expect(amlodipine).toHaveAttribute("aria-selected", "true");
    expect(within(amlodipine).getByText("5 mg - Tablet")).toBeInTheDocument();
    expect(
      within(amlodipine).getByText(
        "Morning 1 · Lunchtime 0 · Evening 0 · Bedtime 1 — Take one twice daily",
      ),
    ).toBeInTheDocument();
    expect(within(amlodipine).getByText("2 daily")).toBeInTheDocument();
    expect(within(amlodipine).getByText("M1 L0 E0 B1")).toBeInTheDocument();
    expect(within(amlodipine).getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(within(amlodipine).getByText("25 Jun 2026")).toBeInTheDocument();
    expect(within(amlodipine).getByText("Latest cycle MDS-2026-W26 · Prepared"))
      .toBeInTheDocument();
    expect(within(metformin).getByText("Discontinued")).toBeInTheDocument();

    await user.click(metformin);
    expect(amlodipine).toHaveAttribute("aria-selected", "false");
    expect(metformin).toHaveAttribute("aria-selected", "true");

    for (const forbidden of [
      "01 Jan 1980",
      "SM1 1AA",
      "020 0000 0001",
      "1 Demo Street, Sutton",
      "NHS",
      "NCRS",
      "View patient NCRS",
    ]) {
      expect(within(medicationItems).queryByText(forbidden)).toBeNull();
    }

    expect(screen.getByText("MDS / Dosette cycle history")).toBeInTheDocument();
    expect(screen.getByText("MDS-2026-W26")).toBeInTheDocument();
    expect(screen.getByText("Prepared")).toBeInTheDocument();
    expect(screen.getByText("pharmacist@example.com")).toBeInTheDocument();
    expect(screen.getByText("checker@example.com")).toBeInTheDocument();
    expect(screen.getByText(/25 Jun 2026.*09:30/)).toBeInTheDocument();
    expect(screen.getByText(/25 Jun 2026.*10:15/)).toBeInTheDocument();
  });

  it("renders safe medication history fallbacks", async () => {
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

    const medicationItems = await screen.findByRole("region", {
      name: "Medication Items",
    });
    expect(within(medicationItems).getByText("Strength/form not recorded"))
      .toBeInTheDocument();
    expect(
      within(medicationItems).getByText(
        "Morning 0 · Lunchtime 0 · Evening 0 · Bedtime 0 — Dosage instructions not recorded.",
      ),
    ).toBeInTheDocument();
    expect(within(medicationItems).getByText("No slot dose")).toBeInTheDocument();
    expect(within(medicationItems).getByText("Not recorded")).toBeInTheDocument();
    expect(within(medicationItems).getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(within(medicationItems).getByText("Latest cycle DRAFT-CYCLE · Draft"))
      .toBeInTheDocument();
    expect(within(medicationItems).queryByText("28 Jul 2026")).toBeNull();
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
