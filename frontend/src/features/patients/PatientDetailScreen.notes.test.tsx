import { Route, Routes } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { PatientDetailScreen } from "./PatientDetailScreen";
import type { Patient, PatientNote } from "./patientApi";
import * as patientApi from "./patientApi";

vi.mock("./patientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patientApi")>();
  return {
    ...actual,
    listPatients: vi.fn(),
    getPatient: vi.fn(),
    listPatientNotes: vi.fn(),
    createPatientNote: vi.fn(),
    createPatient: vi.fn(),
    updatePatient: vi.fn(),
    deactivatePatient: vi.fn(),
  };
});

const getPatientMock = vi.mocked(patientApi.getPatient);
const listPatientNotesMock = vi.mocked(patientApi.listPatientNotes);
const createPatientNoteMock = vi.mocked(patientApi.createPatientNote);

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

function makeNote(overrides: Partial<PatientNote> = {}): PatientNote {
  return {
    id: 1,
    body: "Newest note",
    author: 1,
    author_email: "admin@example.com",
    created_at: "2026-01-19T10:30:00Z",
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

describe("PatientDetailScreen note history", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getPatientMock.mockResolvedValue(makePatient());
    listPatientNotesMock.mockResolvedValue([
      makeNote(),
      makeNote({
        id: 2,
        body: "Older note",
        author_email: "pharmacist@example.com",
        created_at: "2026-01-18T09:15:00Z",
      }),
    ]);
    createPatientNoteMock.mockResolvedValue(makeNote({ id: 3 }));
  });

  it("renders note history in returned order", async () => {
    renderDetail({ "patient.view": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getByText("Note history")).toBeInTheDocument();

    const newest = await screen.findByText("Newest note");
    const older = screen.getByText("Older note");

    expect(
      newest.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("admin@example.com", { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText(/19 Jan 2026.*10:30/),
    ).toBeInTheDocument();
  });

  it("renders empty note history state", async () => {
    listPatientNotesMock.mockResolvedValue([]);

    renderDetail({ "patient.view": true });

    expect(await screen.findByText("No notes recorded yet.")).toBeInTheDocument();
  });

  it("shows Add note only with patient.manage", async () => {
    const { unmount } = renderDetail({
      "patient.view": true,
      "patient.manage": true,
    });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add note" })).toBeInTheDocument();

    unmount();
    renderDetail({ "patient.view": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getByText("Note history")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add note" })).toBeNull();
  });

  it("submits a trimmed note and refetches note history", async () => {
    const user = userEvent.setup();
    renderDetail({ "patient.view": true, "patient.manage": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add note" }));

    const dialog = screen.getByRole("dialog", { name: "Add note" });
    await user.type(within(dialog).getByLabelText("Note body"), "  Follow up note  ");
    await user.click(within(dialog).getByRole("button", { name: "Add note" }));

    await waitFor(() => {
      expect(createPatientNoteMock).toHaveBeenCalledWith(20, {
        body: "Follow up note",
      });
    });
    await waitFor(() => {
      expect(listPatientNotesMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("dialog", { name: "Add note" })).toBeNull();
  });

  it("validates empty note body locally", async () => {
    const user = userEvent.setup();
    renderDetail({ "patient.view": true, "patient.manage": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add note" }));

    const dialog = screen.getByRole("dialog", { name: "Add note" });
    await user.type(within(dialog).getByLabelText("Note body"), "   ");
    await user.click(within(dialog).getByRole("button", { name: "Add note" }));

    expect(await screen.findByText("Note body is required.")).toBeInTheDocument();
    expect(createPatientNoteMock).not.toHaveBeenCalled();
  });

  it("renders backend field errors from add note", async () => {
    createPatientNoteMock.mockRejectedValue(
      new ApiError(400, { body: ["Note body is required."] }),
    );
    const user = userEvent.setup();
    renderDetail({ "patient.view": true, "patient.manage": true });

    expect(await screen.findByText("Alice Sutton")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add note" }));

    const dialog = screen.getByRole("dialog", { name: "Add note" });
    await user.type(within(dialog).getByLabelText("Note body"), "Needs review");
    await user.click(within(dialog).getByRole("button", { name: "Add note" }));

    expect(await screen.findByText("Note body is required.")).toBeInTheDocument();
  });
});
