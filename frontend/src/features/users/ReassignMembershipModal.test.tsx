import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { ApiError, type ManagedUser } from "./usersApi";
import { buildAssignMembershipBody } from "./assignmentBody";
import { ReassignMembershipModal } from "./ReassignMembershipModal";
import * as usersApi from "./usersApi";

vi.mock("./usersApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./usersApi")>();
  return {
    ...actual,
    listUsers: vi.fn(),
    createUser: vi.fn(),
    deactivateUser: vi.fn(),
    resetPassword: vi.fn(),
    listPharmaciesForPicker: vi.fn(),
    assignMembership: vi.fn(),
    listGroupsForPicker: vi.fn(),
  };
});

const assignMembershipMock = vi.mocked(usersApi.assignMembership);
const listGroupsForPickerMock = vi.mocked(usersApi.listGroupsForPicker);
const listPharmaciesForPickerMock = vi.mocked(usersApi.listPharmaciesForPicker);

function targetUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id: 10,
    email: "target@example.com",
    full_name: "Target User",
    is_active: true,
    must_change_password: false,
    role: "DISPENSER",
    pharmacy: { id: 3, name: "Central Pharmacy" },
    date_joined: "2026-06-17T09:00:00Z",
    ...overrides,
  };
}

function renderModal({
  auth = makeAuthContext(),
  onClose = vi.fn(),
}: {
  auth?: ReturnType<typeof makeAuthContext>;
  onClose?: () => void;
} = {}) {
  renderWithProviders(
    <ReassignMembershipModal user={targetUser()} onClose={onClose} />,
    { auth },
  );
  return { onClose };
}

describe("buildAssignMembershipBody", () => {
  it("sends only role-appropriate fields", () => {
    expect(
      buildAssignMembershipBody({
        role: "SUPERINTENDENT",
        isGlobalRequester: true,
        groupId: "2",
        pharmacyId: "7",
        pharmacyIds: ["7"],
      }),
    ).toEqual({ role: "SUPERINTENDENT", group_id: 2 });

    expect(
      buildAssignMembershipBody({
        role: "STOCK_EMPLOYEE",
        isGlobalRequester: true,
        groupId: "2",
        pharmacyId: "7",
        pharmacyIds: ["7", "8"],
      }),
    ).toEqual({ role: "STOCK_EMPLOYEE", group_id: 2, pharmacy_ids: [7, 8] });

    expect(
      buildAssignMembershipBody({
        role: "PHARMACIST",
        isGlobalRequester: true,
        groupId: "2",
        pharmacyId: "7",
        pharmacyIds: ["8"],
      }),
    ).toEqual({ role: "PHARMACIST", pharmacy_id: 7 });

    expect(
      buildAssignMembershipBody({
        role: "ADMIN",
        isGlobalRequester: true,
        groupId: "2",
        pharmacyId: "7",
        pharmacyIds: ["8"],
      }),
    ).toEqual({ role: "ADMIN" });
  });
});

describe("ReassignMembershipModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    assignMembershipMock.mockResolvedValue(targetUser());
    listGroupsForPickerMock.mockResolvedValue([
      { id: 1, name: "Group One" },
      { id: 2, name: "Group Two" },
    ]);
    listPharmaciesForPickerMock.mockResolvedValue([
      { id: 10, name: "North Pharmacy", group: 1 },
      { id: 11, name: "South Pharmacy", group: 1 },
      { id: 20, name: "East Pharmacy", group: 2 },
    ]);
  });

  it("admin modal shows scope fields for scoped roles and none for ADMIN", async () => {
    const user = userEvent.setup();
    renderModal();

    const roleSelect = screen.getByLabelText("Role");
    expect(screen.queryByLabelText("Group")).toBeNull();
    expect(screen.queryByLabelText("Pharmacy")).toBeNull();
    expect(screen.queryByLabelText("Pharmacies")).toBeNull();

    await user.selectOptions(roleSelect, "SUPERINTENDENT");
    expect(await screen.findByLabelText("Group")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pharmacy")).toBeNull();

    await user.selectOptions(roleSelect, "STOCK_EMPLOYEE");
    expect(screen.getByLabelText("Group")).toBeInTheDocument();
    expect(screen.getByLabelText(/pharmacies/i)).toBeInTheDocument();

    await user.selectOptions(roleSelect, "PHARMACIST");
    expect(screen.queryByLabelText("Group")).toBeNull();
    expect(screen.getByLabelText("Pharmacy")).toBeInTheDocument();

    await user.selectOptions(roleSelect, "ADMIN");
    expect(screen.queryByLabelText("Group")).toBeNull();
    expect(screen.queryByLabelText("Pharmacy")).toBeNull();
    expect(screen.queryByLabelText("Pharmacies")).toBeNull();
  });

  it("submits SUPERINTENDENT with only role and group_id", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText("Role"), "SUPERINTENDENT");
    await user.selectOptions(await screen.findByLabelText("Group"), "2");
    await user.click(screen.getByRole("button", { name: "Save membership" }));

    await waitFor(() => {
      expect(assignMembershipMock).toHaveBeenCalledWith(10, {
        role: "SUPERINTENDENT",
        group_id: 2,
      });
    });
  });

  it("submits STOCK_EMPLOYEE with only role, group_id, and pharmacy_ids", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText("Role"), "STOCK_EMPLOYEE");
    await user.selectOptions(await screen.findByLabelText("Group"), "1");
    await user.selectOptions(screen.getByLabelText(/pharmacies/i), [
      "10",
      "11",
    ]);
    await user.click(screen.getByRole("button", { name: "Save membership" }));

    await waitFor(() => {
      expect(assignMembershipMock).toHaveBeenCalledWith(10, {
        role: "STOCK_EMPLOYEE",
        group_id: 1,
        pharmacy_ids: [10, 11],
      });
    });
  });

  it("filters STOCK_EMPLOYEE pharmacies by selected group", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText("Role"), "STOCK_EMPLOYEE");
    await user.selectOptions(await screen.findByLabelText("Group"), "2");

    const pharmaciesSelect = screen.getByLabelText(/pharmacies/i);
    expect(
      within(pharmaciesSelect).getByRole("option", { name: "East Pharmacy" }),
    ).toBeInTheDocument();
    expect(
      within(pharmaciesSelect).queryByRole("option", {
        name: "North Pharmacy",
      }),
    ).toBeNull();
  });

  it("submits PHARMACIST with only role and pharmacy_id", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText("Role"), "PHARMACIST");
    await user.selectOptions(await screen.findByLabelText("Pharmacy"), "20");
    await user.click(screen.getByRole("button", { name: "Save membership" }));

    await waitFor(() => {
      expect(assignMembershipMock).toHaveBeenCalledWith(10, {
        role: "PHARMACIST",
        pharmacy_id: 20,
      });
    });
  });

  it("submits ADMIN with only role", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Save membership" }));

    await waitFor(() => {
      expect(assignMembershipMock).toHaveBeenCalledWith(10, { role: "ADMIN" });
    });
  });

  it("pharmacist requester sees only pharmacy roles and own pharmacy read-only", () => {
    renderModal({
      auth: makeAuthContext({
        user: makeAuthUser({
          role: "PHARMACIST",
          scope: {
            is_global: false,
            group_ids: [],
            pharmacy_ids: [10],
          },
          pharmacies: [{ id: 10, name: "North Pharmacy" }],
        }),
      }),
    });

    const roleSelect = screen.getByLabelText("Role");
    expect(
      within(roleSelect).getByRole("option", { name: "Pharmacist" }),
    ).toBeInTheDocument();
    expect(
      within(roleSelect).getByRole("option", { name: "Dispenser" }),
    ).toBeInTheDocument();
    expect(
      within(roleSelect).queryByRole("option", { name: "Admin" }),
    ).toBeNull();
    expect(screen.getByText("North Pharmacy")).toBeInTheDocument();
    expect(listGroupsForPickerMock).not.toHaveBeenCalled();
    expect(listPharmaciesForPickerMock).not.toHaveBeenCalled();
  });

  it("pharmacist requester submits own pharmacy id automatically", async () => {
    const user = userEvent.setup();
    renderModal({
      auth: makeAuthContext({
        user: makeAuthUser({
          role: "PHARMACIST",
          scope: {
            is_global: false,
            group_ids: [],
            pharmacy_ids: [10],
          },
          pharmacies: [{ id: 10, name: "North Pharmacy" }],
        }),
      }),
    });

    await user.selectOptions(screen.getByLabelText("Role"), "DISPENSER");
    await user.click(screen.getByRole("button", { name: "Save membership" }));

    await waitFor(() => {
      expect(assignMembershipMock).toHaveBeenCalledWith(10, {
        role: "DISPENSER",
        pharmacy_id: 10,
      });
    });
  });

  it("renders backend field, non-field, and detail errors inline", async () => {
    assignMembershipMock.mockRejectedValue(
      new ApiError("Bad request", 400, {
        group_id: ["Invalid group."],
        non_field_errors: ["Membership is invalid."],
        detail: "You do not have permission.",
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText("Role"), "SUPERINTENDENT");
    await user.selectOptions(await screen.findByLabelText("Group"), "1");
    await user.click(screen.getByRole("button", { name: "Save membership" }));

    expect(await screen.findByText("Invalid group.")).toBeInTheDocument();
    expect(screen.getByText("Membership is invalid.")).toBeInTheDocument();
    expect(screen.getByText("You do not have permission.")).toBeInTheDocument();
  });

  it("renders backend 403 detail errors inline", async () => {
    assignMembershipMock.mockRejectedValue(
      new ApiError("Forbidden", 403, {
        detail: "You can only assign users in your pharmacy.",
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Save membership" }));

    expect(
      await screen.findByText("You can only assign users in your pharmacy."),
    ).toBeInTheDocument();
  });
});
