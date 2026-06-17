import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import { PharmacyFormModal } from "./PharmacyFormModal";
import type { Group, Pharmacy } from "./tenancyApi";
import * as tenancyApi from "./tenancyApi";

vi.mock("./tenancyApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tenancyApi")>();
  return {
    ...actual,
    listGroups: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    listPharmacies: vi.fn(),
    createPharmacy: vi.fn(),
    updatePharmacy: vi.fn(),
  };
});

const listGroupsMock = vi.mocked(tenancyApi.listGroups);
const createPharmacyMock = vi.mocked(tenancyApi.createPharmacy);
const updatePharmacyMock = vi.mocked(tenancyApi.updatePharmacy);

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 1,
    name: "North Group",
    slug: "north-group",
    is_active: true,
    created_at: "2026-06-17T09:00:00Z",
    updated_at: "2026-06-17T09:00:00Z",
    ...overrides,
  };
}

function makePharmacy(overrides: Partial<Pharmacy> = {}): Pharmacy {
  return {
    id: 10,
    group: 1,
    name: "Central Pharmacy",
    code: "CP1",
    address: "1 High Street",
    postcode: "AB1 2CD",
    is_active: true,
    created_at: "2026-06-17T09:00:00Z",
    updated_at: "2026-06-17T09:00:00Z",
    ...overrides,
  };
}

describe("PharmacyFormModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listGroupsMock.mockResolvedValue([
      makeGroup(),
      makeGroup({ id: 2, name: "South Group", slug: "south-group" }),
    ]);
    createPharmacyMock.mockResolvedValue(makePharmacy());
    updatePharmacyMock.mockResolvedValue(makePharmacy());
  });

  it("create form group select is populated from groups query", async () => {
    renderWithProviders(
      <PharmacyFormModal pharmacy={null} isOpen onClose={vi.fn()} />,
    );

    expect(
      await screen.findByRole("option", { name: "North Group" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "South Group" })).toBeInTheDocument();
  });

  it("create submit calls createPharmacy with full body", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PharmacyFormModal pharmacy={null} isOpen onClose={vi.fn()} />,
    );

    await screen.findByRole("option", { name: "North Group" });
    await user.selectOptions(screen.getByLabelText("Group"), "1");
    await user.type(screen.getByLabelText("Name"), "Central Pharmacy");
    await user.type(screen.getByLabelText("Code"), "CP1");
    await user.type(screen.getByLabelText("Address"), "1 High Street");
    await user.type(screen.getByLabelText("Postcode"), "AB1 2CD");
    await user.click(screen.getByRole("button", { name: "Save pharmacy" }));

    await waitFor(() => {
      expect(createPharmacyMock).toHaveBeenCalledWith({
        group: 1,
        name: "Central Pharmacy",
        code: "CP1",
        address: "1 High Street",
        postcode: "AB1 2CD",
        is_active: true,
      });
    });
  });

  it("duplicate group/code backend 400 renders on code field", async () => {
    createPharmacyMock.mockRejectedValue(
      new ApiError(400, {
        code: ["A pharmacy with this code already exists in this group."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <PharmacyFormModal pharmacy={null} isOpen onClose={vi.fn()} />,
    );

    await screen.findByRole("option", { name: "North Group" });
    await user.selectOptions(screen.getByLabelText("Group"), "1");
    await user.type(screen.getByLabelText("Name"), "Central Pharmacy");
    await user.type(screen.getByLabelText("Code"), "CP1");
    await user.click(screen.getByRole("button", { name: "Save pharmacy" }));

    expect(
      await screen.findByText(
        "A pharmacy with this code already exists in this group.",
      ),
    ).toBeInTheDocument();
  });

  it("required-field validation works for group, name, and code", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PharmacyFormModal pharmacy={null} isOpen onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Save pharmacy" }));

    expect(await screen.findByText("Group is required.")).toBeInTheDocument();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Code is required.")).toBeInTheDocument();
    expect(createPharmacyMock).not.toHaveBeenCalled();
  });

  it("edit form pre-fills existing pharmacy", async () => {
    renderWithProviders(
      <PharmacyFormModal pharmacy={makePharmacy()} isOpen onClose={vi.fn()} />,
    );

    await screen.findByRole("option", { name: "North Group" });
    expect(screen.getByLabelText("Group")).toHaveValue("1");
    expect(screen.getByLabelText("Name")).toHaveValue("Central Pharmacy");
    expect(screen.getByLabelText("Code")).toHaveValue("CP1");
    expect(screen.getByLabelText("Address")).toHaveValue("1 High Street");
    expect(screen.getByLabelText("Postcode")).toHaveValue("AB1 2CD");
    expect(screen.getByLabelText("Active")).toBeChecked();
  });

  it("edit submit calls updatePharmacy", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PharmacyFormModal pharmacy={makePharmacy()} isOpen onClose={vi.fn()} />,
    );

    await screen.findByLabelText("Group");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Updated Pharmacy");
    await user.clear(screen.getByLabelText("Code"));
    await user.type(screen.getByLabelText("Code"), "UP1");
    await user.click(screen.getByLabelText("Active"));
    await user.click(screen.getByRole("button", { name: "Save pharmacy" }));

    await waitFor(() => {
      expect(updatePharmacyMock).toHaveBeenCalledWith(10, {
        group: 1,
        name: "Updated Pharmacy",
        code: "UP1",
        address: "1 High Street",
        postcode: "AB1 2CD",
        is_active: false,
      });
    });
  });
});
