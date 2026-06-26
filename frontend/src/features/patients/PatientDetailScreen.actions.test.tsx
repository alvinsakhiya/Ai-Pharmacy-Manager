import { Route, Routes } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
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
    createPatient: vi.fn(),
    updatePatient: vi.fn(),
    deactivatePatient: vi.fn(),
  };
});

const getPatientMock = vi.mocked(patientApi.getPatient);
const listPatientNotesMock = vi.mocked(patientApi.listPatientNotes);
const deactivatePatientMock = vi.mocked(patientApi.deactivatePatient);

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

function patientAuth(permissions: Record<string, boolean>) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions,
      pharmacies: [{ id: 1, name: "JMW Sutton" }],
    }),
  });
}

function renderDetail(permissions: Record<string, boolean>) {
  return renderWithProviders(
    <Routes>
      <Route element={<PatientDetailScreen />} path="/patients/:patientId" />
    </Routes>,
    { auth: patientAuth(permissions), route: "/patients/20" },
  );
}

describe("PatientDetailScreen actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getPatientMock.mockResolvedValue(makePatient());
    listPatientNotesMock.mockResolvedValue([]);
    deactivatePatientMock.mockResolvedValue(makePatient({ is_active: false }));
  });

  it("shows Edit and Deactivate with patient.manage for an active patient", async () => {
    renderDetail({ "patient.view": true, "patient.manage": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Deactivate" }),
    ).toBeInTheDocument();
  });

  it("confirms deactivate through a modal", async () => {
    const user = userEvent.setup();
    renderDetail({ "patient.view": true, "patient.manage": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    const dialog = screen.getByRole("dialog", {
      name: "Deactivate this patient?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    await waitFor(() => {
      expect(deactivatePatientMock).toHaveBeenCalledWith(20);
    });
  });

  it("opens edit patient modal with patient.manage", async () => {
    const user = userEvent.setup();
    renderDetail({ "patient.view": true, "patient.manage": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = screen.getByRole("dialog", { name: "Edit patient" });
    expect(within(dialog).getByLabelText("Patient ID")).toBeDisabled();
    expect(within(dialog).getByDisplayValue("Alice")).toBeInTheDocument();
  });

  it("hides Deactivate for inactive patients", async () => {
    getPatientMock.mockResolvedValue(makePatient({ is_active: false }));

    renderDetail({ "patient.view": true, "patient.manage": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
  });

  it("hides write controls for read-only users", async () => {
    renderDetail({ "patient.view": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
  });
});
