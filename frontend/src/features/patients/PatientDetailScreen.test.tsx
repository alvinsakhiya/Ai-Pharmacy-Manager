import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
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
  };
});

const getPatientMock = vi.mocked(patientApi.getPatient);
const listPatientNotesMock = vi.mocked(patientApi.listPatientNotes);

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
