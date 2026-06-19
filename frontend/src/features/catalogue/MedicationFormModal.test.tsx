import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { Group } from "../tenancy/tenancyApi";
import * as tenancyApi from "../tenancy/tenancyApi";
import { MedicationFormModal } from "./MedicationFormModal";
import type { Medication } from "./catalogueApi";
import * as catalogueApi from "./catalogueApi";

vi.mock("./catalogueApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./catalogueApi")>();
  return {
    ...actual,
    listMedications: vi.fn(),
    createMedication: vi.fn(),
    updateMedication: vi.fn(),
  };
});

vi.mock("../tenancy/tenancyApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tenancy/tenancyApi")>();
  return {
    ...actual,
    listGroups: vi.fn(),
  };
});

const listMedicationsMock = vi.mocked(catalogueApi.listMedications);
const createMedicationMock = vi.mocked(catalogueApi.createMedication);
const updateMedicationMock = vi.mocked(catalogueApi.updateMedication);
const listGroupsMock = vi.mocked(tenancyApi.listGroups);

function makeMedication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 20,
    group: 1,
    name: "Paracetamol",
    form: "TABLET",
    strength: "500 mg",
    manufacturer: "Generic",
    notes: "Keep in catalogue",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 1,
    name: "North Group",
    slug: "north-group",
    is_active: true,
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function medicationAuth({
  isGlobal = true,
  groupIds = [],
}: {
  isGlobal?: boolean;
  groupIds?: number[];
} = {}) {
  return makeAuthContext({
    user: makeAuthUser({
      role: isGlobal ? "ADMIN" : "PHARMACIST",
      scope: {
        is_global: isGlobal,
        group_ids: groupIds,
        pharmacy_ids: isGlobal ? [] : [10],
      },
      permissions: {
        "medication.view": true,
        "medication.manage": true,
      },
    }),
  });
}

describe("MedicationFormModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listMedicationsMock.mockResolvedValue([makeMedication()]);
    listGroupsMock.mockResolvedValue([
      makeGroup(),
      makeGroup({ id: 2, name: "South Group", slug: "south-group" }),
    ]);
    createMedicationMock.mockResolvedValue(makeMedication());
    updateMedicationMock.mockResolvedValue(makeMedication());
  });

  it("create submit calls createMedication with the write body", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth() },
    );

    await screen.findByRole("option", { name: "North Group" });
    await user.selectOptions(screen.getByLabelText("Group"), "1");
    await user.type(screen.getByLabelText("Name"), "Amlodipine");
    await user.selectOptions(screen.getByLabelText("Form"), "TABLET");
    await user.type(screen.getByLabelText("Strength"), "5 mg");
    await user.type(screen.getByLabelText("Manufacturer"), "Generic");
    await user.type(screen.getByLabelText("Notes"), "Once daily");
    await user.click(screen.getByRole("button", { name: "Save medication" }));

    await waitFor(() => {
      expect(createMedicationMock).toHaveBeenCalledWith({
        group: 1,
        name: "Amlodipine",
        form: "TABLET",
        strength: "5 mg",
        manufacturer: "Generic",
        notes: "Once daily",
        is_active: true,
      });
    });
  });

  it("edit form pre-fills and submits updateMedication with the write body", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={makeMedication()} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth() },
    );

    expect(screen.getByLabelText("Group")).toHaveValue("1");
    expect(screen.getByLabelText("Group")).toBeDisabled();
    expect(screen.getByLabelText("Name")).toHaveValue("Paracetamol");
    expect(screen.getByLabelText("Form")).toHaveValue("TABLET");
    expect(screen.getByLabelText("Strength")).toHaveValue("500 mg");
    expect(screen.getByLabelText("Manufacturer")).toHaveValue("Generic");
    expect(screen.getByLabelText("Notes")).toHaveValue("Keep in catalogue");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Paracetamol Caplets");
    await user.clear(screen.getByLabelText("Strength"));
    await user.type(screen.getByLabelText("Strength"), "500 mg");
    await user.click(screen.getByLabelText("Active"));
    await user.click(screen.getByRole("button", { name: "Save medication" }));

    await waitFor(() => {
      expect(updateMedicationMock).toHaveBeenCalledWith(20, {
        group: 1,
        name: "Paracetamol Caplets",
        form: "TABLET",
        strength: "500 mg",
        manufacturer: "Generic",
        notes: "Keep in catalogue",
        is_active: false,
      });
    });
  });

  it("renders duplicate backend non-field errors", async () => {
    createMedicationMock.mockRejectedValue(
      new ApiError(400, {
        non_field_errors: [
          "A medication with this name, form, and strength already exists.",
        ],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth() },
    );

    await screen.findByRole("option", { name: "North Group" });
    await user.selectOptions(screen.getByLabelText("Group"), "1");
    await user.type(screen.getByLabelText("Name"), "Paracetamol");
    await user.type(screen.getByLabelText("Strength"), "500 mg");
    await user.click(screen.getByRole("button", { name: "Save medication" }));

    expect(
      await screen.findByText(
        "A medication with this name, form, and strength already exists.",
      ),
    ).toBeInTheDocument();
  });

  it("required-field validation blocks blank name and strength", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth() },
    );

    await screen.findByRole("option", { name: "North Group" });
    await user.selectOptions(screen.getByLabelText("Group"), "1");
    await user.click(screen.getByRole("button", { name: "Save medication" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Strength is required.")).toBeInTheDocument();
    expect(createMedicationMock).not.toHaveBeenCalled();
  });

  it("non-admin create derives a single group without calling listGroups", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth({ isGlobal: false, groupIds: [7] }) },
    );

    expect(screen.getByLabelText("Group")).toHaveValue("7");
    expect(screen.getByLabelText("Group")).toBeDisabled();
    await user.type(screen.getByLabelText("Name"), "Metformin");
    await user.type(screen.getByLabelText("Strength"), "500 mg");
    await user.click(screen.getByRole("button", { name: "Save medication" }));

    await waitFor(() => {
      expect(createMedicationMock).toHaveBeenCalledWith({
        group: 7,
        name: "Metformin",
        form: "TABLET",
        strength: "500 mg",
        manufacturer: "",
        notes: "",
        is_active: true,
      });
    });
    expect(listGroupsMock).not.toHaveBeenCalled();
  });

  it("non-admin with no resolvable group disables submit and shows note", async () => {
    listMedicationsMock.mockResolvedValue([]);

    renderWithProviders(
      <MedicationFormModal medication={null} isOpen onClose={vi.fn()} />,
      { auth: medicationAuth({ isGlobal: false }) },
    );

    expect(
      await screen.findByText(
        "Ask an administrator or superintendent to add the first medication for this group.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save medication" })).toBeDisabled();
    expect(listGroupsMock).not.toHaveBeenCalled();
  });
});
