import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  };
});

const listPatientsMock = vi.mocked(patientApi.listPatients);

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

function patientAuth(pharmacyCount = 2) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "patient.view": true,
      },
      pharmacies: [
        { id: 1, name: "JMW Sutton" },
        { id: 2, name: "JMW Croydon" },
      ].slice(0, pharmacyCount),
    }),
  });
}

describe("PatientsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listPatientsMock.mockResolvedValue([
      makePatient(),
      makePatient({
        id: 21,
        pharmacy: 2,
        patient_reference: "CRO-P1",
        first_name: "Bob",
        last_name: "Croydon",
        is_active: false,
      }),
    ]);
  });

  it("renders patient rows from list data", async () => {
    renderWithProviders(<PatientsScreen />, { auth: patientAuth() });

    expect(await screen.findByText("SUT-P1")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Patient ID" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Sutton")).toBeInTheDocument();
    expect(screen.getAllByText("JMW Sutton").length).toBeGreaterThan(0);
    expect(screen.getByText("CRO-P1")).toBeInTheDocument();
    expect(screen.getByText("Bob Croydon")).toBeInTheDocument();
    expect(screen.getAllByText("JMW Croydon").length).toBeGreaterThan(0);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    listPatientsMock.mockResolvedValue([]);

    renderWithProviders(<PatientsScreen />, { auth: patientAuth() });

    expect(await screen.findByText("No patients yet.")).toBeInTheDocument();
  });

  it("links each row to patient detail", async () => {
    renderWithProviders(<PatientsScreen />, { auth: patientAuth() });

    const viewLinks = await screen.findAllByRole("link", { name: "View" });

    expect(viewLinks[0]).toHaveAttribute("href", "/patients/20");
  });

  it("shows pharmacy filter when user has more than one pharmacy", async () => {
    renderWithProviders(<PatientsScreen />, { auth: patientAuth() });

    expect(await screen.findByLabelText("Pharmacy")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "All pharmacies" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "JMW Sutton" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "JMW Croydon" })).toBeInTheDocument();
  });

  it("does not show pharmacy filter for a single scoped pharmacy", () => {
    renderWithProviders(<PatientsScreen />, { auth: patientAuth(1) });

    expect(screen.queryByLabelText("Pharmacy")).toBeNull();
  });

  it("passes selected pharmacy to the list query", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PatientsScreen />, { auth: patientAuth() });

    await screen.findByText("SUT-P1");
    await user.selectOptions(screen.getByLabelText("Pharmacy"), "2");

    await waitFor(() => {
      expect(listPatientsMock).toHaveBeenLastCalledWith({
        pharmacy: 2,
        search: "",
      });
    });
  });

  it("passes trimmed search to the list query", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PatientsScreen />, { auth: patientAuth() });

    await screen.findByText("SUT-P1");
    expect(
      screen.getByPlaceholderText("Search by Patient ID or exact last name"),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search"), " Sutton ");

    await waitFor(() => {
      expect(listPatientsMock).toHaveBeenLastCalledWith({
        pharmacy: undefined,
        search: "Sutton",
      });
    });
  });

  it("shows error state with retry", async () => {
    listPatientsMock.mockRejectedValue(new Error("Network error"));

    renderWithProviders(<PatientsScreen />, { auth: patientAuth() });

    expect(await screen.findByText("Could not load patients.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
