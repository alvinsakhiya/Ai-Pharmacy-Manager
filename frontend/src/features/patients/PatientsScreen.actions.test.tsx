import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { Patient } from "./patientApi";
import * as patientApi from "./patientApi";
import { PatientsScreen } from "./PatientsScreen";

vi.mock("./patientApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patientApi")>();
  return {
    ...actual,
    listPatients: vi.fn(),
    getPatient: vi.fn(),
    createPatient: vi.fn(),
    updatePatient: vi.fn(),
    deactivatePatient: vi.fn(),
  };
});

const listPatientsMock = vi.mocked(patientApi.listPatients);

function makePatient(): Patient {
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

describe("PatientsScreen actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listPatientsMock.mockResolvedValue([makePatient()]);
  });

  it("shows Create patient with patient.manage", async () => {
    renderWithProviders(<PatientsScreen />, {
      auth: patientAuth({ "patient.view": true, "patient.manage": true }),
    });

    expect(await screen.findByText("SUT-P1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create patient" }),
    ).toBeInTheDocument();
  });

  it("hides Create patient for read-only users", async () => {
    renderWithProviders(<PatientsScreen />, {
      auth: patientAuth({ "patient.view": true }),
    });

    expect(await screen.findByText("SUT-P1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create patient" })).toBeNull();
  });
});
