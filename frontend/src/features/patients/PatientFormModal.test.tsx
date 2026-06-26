import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { PatientFormModal } from "./PatientFormModal";
import type { Patient } from "./patientApi";
import * as patientApi from "./patientApi";

vi.mock("./patientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patientApi")>();
  return {
    ...actual,
    createPatient: vi.fn(),
    updatePatient: vi.fn(),
    deactivatePatient: vi.fn(),
  };
});

const createPatientMock = vi.mocked(patientApi.createPatient);
const updatePatientMock = vi.mocked(patientApi.updatePatient);

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 20,
    pharmacy: 1,
    patient_reference: "SUT-P1",
    first_name: "Alice",
    last_name: "Sutton",
    date_of_birth: "1980-01-01",
    address: "1 Demo Street",
    postcode: "SM1 1AA",
    phone: "020 0000 0001",
    notes: "Fictional patient note",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function patientAuth(pharmacyCount = 1) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "patient.view": true,
        "patient.manage": true,
      },
      pharmacies: [
        { id: 1, name: "JMW Sutton" },
        { id: 2, name: "JMW Croydon" },
      ].slice(0, pharmacyCount),
    }),
  });
}

async function fillCreateForm() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("First name"), "Clara");
  await user.type(screen.getByLabelText("Last name"), "Demo");
  await user.type(screen.getByLabelText("Date of birth"), "1990-02-03");
  await user.type(screen.getByLabelText("Address"), "2 Demo Street");
  await user.type(screen.getByLabelText("Postcode"), "SM2 2AA");
  await user.type(screen.getByLabelText("Phone"), "020 0000 0002");
  await user.type(screen.getByLabelText("Notes"), "Create note");

  return user;
}

describe("PatientFormModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createPatientMock.mockResolvedValue(makePatient());
    updatePatientMock.mockResolvedValue(makePatient());
  });

  it("submits create data with numeric pharmacy", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <PatientFormModal isOpen onClose={onClose} patient={null} />,
      { auth: patientAuth() },
    );

    expect(
      screen.getByText("Patient ID will be generated automatically when saved."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Patient reference")).toBeNull();

    const user = await fillCreateForm();
    await user.click(screen.getByRole("button", { name: "Save patient" }));

    await waitFor(() => {
      expect(createPatientMock).toHaveBeenCalledWith({
        pharmacy: 1,
        title: "",
        first_name: "Clara",
        last_name: "Demo",
        date_of_birth: "1990-02-03",
        gender: "",
        address: "2 Demo Street",
        postcode: "SM2 2AA",
        phone: "020 0000 0002",
        email: "",
        notes: "Create note",
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("prefills edit data and submits without pharmacy", async () => {
    const user = userEvent.setup();
    const patient = makePatient();
    renderWithProviders(
      <PatientFormModal isOpen onClose={vi.fn()} patient={patient} />,
      { auth: patientAuth(2) },
    );

    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sutton")).toBeInTheDocument();
    expect(screen.getByLabelText("Patient ID")).toBeDisabled();
    expect(screen.getByLabelText("Patient ID")).toHaveValue("SUT-P1");

    await user.clear(screen.getByLabelText("Last name"));
    await user.type(screen.getByLabelText("Last name"), "Updated");
    await user.click(screen.getByRole("button", { name: "Save patient" }));

    await waitFor(() => {
      expect(updatePatientMock).toHaveBeenCalledWith(20, {
        title: "",
        first_name: "Alice",
        last_name: "Updated",
        date_of_birth: "1980-01-01",
        gender: "",
        address: "1 Demo Street",
        postcode: "SM1 1AA",
        phone: "020 0000 0001",
        email: "",
        notes: "Fictional patient note",
      });
    });
    expect(updatePatientMock.mock.calls[0][1]).not.toHaveProperty("pharmacy");
  });

  it("renders pharmacy read-only in edit mode", () => {
    renderWithProviders(
      <PatientFormModal isOpen onClose={vi.fn()} patient={makePatient()} />,
      { auth: patientAuth(2) },
    );

    expect(screen.getByDisplayValue("JMW Sutton")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Pharmacy" })).toBeNull();
  });

  it("blocks submit when required fields are missing", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PatientFormModal isOpen onClose={vi.fn()} patient={null} />,
      { auth: patientAuth() },
    );

    await user.type(screen.getByLabelText("First name"), "Clara");
    await user.type(screen.getByLabelText("Date of birth"), "1990-02-03");
    await user.click(screen.getByRole("button", { name: "Save patient" }));

    expect(await screen.findByText("Last name is required.")).toBeInTheDocument();
    expect(createPatientMock).not.toHaveBeenCalled();
  });

  it("renders backend field errors", async () => {
    createPatientMock.mockRejectedValue(
      new ApiError(400, {
        patient_reference: ["Patient ID is generated automatically."],
      }),
    );
    renderWithProviders(
      <PatientFormModal isOpen onClose={vi.fn()} patient={null} />,
      { auth: patientAuth() },
    );

    const user = await fillCreateForm();
    await user.click(screen.getByRole("button", { name: "Save patient" }));

    expect(
      await screen.findByText("Patient ID is generated automatically."),
    ).toBeInTheDocument();
  });
});
