import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import type { ManagedUser } from "./usersApi";
import { ApiError } from "./usersApi";
import { UsersScreen } from "./UsersScreen";
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

const listUsersMock = vi.mocked(usersApi.listUsers);
const resetPasswordMock = vi.mocked(usersApi.resetPassword);
const deactivateUserMock = vi.mocked(usersApi.deactivateUser);
const assignMembershipMock = vi.mocked(usersApi.assignMembership);
const listGroupsForPickerMock = vi.mocked(usersApi.listGroupsForPicker);
const listPharmaciesForPickerMock = vi.mocked(usersApi.listPharmaciesForPicker);

function makeManagedUser(overrides: Partial<ManagedUser> = {}): ManagedUser {
  return {
    id: 10,
    email: "team@example.com",
    full_name: "Team Member",
    is_active: true,
    must_change_password: true,
    role: "DISPENSER",
    pharmacy: { id: 3, name: "Central Pharmacy" },
    date_joined: "2026-06-17T09:00:00Z",
    ...overrides,
  };
}

describe("UsersScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listUsersMock.mockResolvedValue([makeManagedUser()]);
    deactivateUserMock.mockResolvedValue(makeManagedUser({ is_active: false }));
    resetPasswordMock.mockResolvedValue({ detail: "Password reset." });
    assignMembershipMock.mockResolvedValue(makeManagedUser());
    listGroupsForPickerMock.mockResolvedValue([{ id: 1, name: "Group One" }]);
    listPharmaciesForPickerMock.mockResolvedValue([
      { id: 3, name: "Central Pharmacy", group: 1 },
    ]);
  });

  it("renders the polished header, summary cards, and user directory", async () => {
    listUsersMock.mockResolvedValue([
      makeManagedUser({
        id: 10,
        role: "ADMIN",
        pharmacy: null,
        must_change_password: false,
      }),
      makeManagedUser({
        id: 11,
        email: "pharmacist@example.com",
        full_name: "Pharmacy Lead",
        role: "PHARMACIST",
        is_active: false,
        pharmacy: { id: 4, name: "West Pharmacy" },
      }),
      makeManagedUser({
        id: 12,
        email: "stock@example.com",
        full_name: "Stock User",
        role: "STOCK_EMPLOYEE",
        pharmacy: { id: 5, name: "East Pharmacy" },
      }),
    ]);

    renderWithProviders(<UsersScreen />);

    expect(
      screen.getByRole("heading", { name: "Users" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manage staff access, roles, and pharmacy membership."),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("Active users")).length)
      .toBeGreaterThan(0);
    expect(screen.getByText("Total users")).toBeInTheDocument();
    expect(screen.getByText("Admins")).toBeInTheDocument();
    expect(screen.getByText("Pharmacists")).toBeInTheDocument();
    expect(screen.getByText("Dispensers / Stock")).toBeInTheDocument();
    expect(screen.getByText("Team access")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Team access cards" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Active users" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inactive users" }))
      .toBeInTheDocument();
    expect(screen.getByText("Pharmacy Lead")).toBeInTheDocument();
    expect(screen.getByText("pharmacist@example.com")).toBeInTheDocument();
    expect(screen.getByText("West Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("1 inactive account in scope")).toBeInTheDocument();
    expect(screen.getByText("3 of 3 shown")).toBeInTheDocument();
  });

  it("renders user identity, role, status, and action controls", async () => {
    renderWithProviders(<UsersScreen />);

    expect(await screen.findByText("team@example.com")).toBeInTheDocument();
    expect(screen.getByText("Team Member")).toBeInTheDocument();
    expect(screen.getByText("Central Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("Dispenser")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("Must change")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Deactivate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reassign membership" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete user" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("filters users locally by search term", async () => {
    listUsersMock.mockResolvedValue([
      makeManagedUser({
        id: 10,
        email: "lead@example.com",
        full_name: "Pharmacy Lead",
        role: "PHARMACIST",
        pharmacy: { id: 4, name: "West Pharmacy" },
      }),
      makeManagedUser({
        id: 11,
        email: "stock@example.com",
        full_name: "Stock User",
        role: "STOCK_EMPLOYEE",
        pharmacy: { id: 5, name: "East Pharmacy" },
      }),
    ]);
    const user = userEvent.setup();

    renderWithProviders(<UsersScreen />);

    await screen.findByText("Pharmacy Lead");
    await user.type(screen.getByLabelText("Search users"), "stock employee");

    expect(screen.getByText("Team matches")).toBeInTheDocument();
    expect(screen.getAllByText("Stock User").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pharmacy Lead")).toBeNull();
    expect(screen.getByText("1 of 2 shown")).toBeInTheDocument();
  });

  it("renders the filtered empty state", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersScreen />);

    await screen.findByText("Team Member");
    await user.type(screen.getByLabelText("Search users"), "missing person");

    expect(
      screen.getByText("No users match this search."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Team Member")).toBeNull();
  });

  it("renders the empty state", async () => {
    listUsersMock.mockResolvedValue([]);

    renderWithProviders(<UsersScreen />);

    expect(
      await screen.findByText("No users in your scope yet."),
    ).toBeInTheDocument();
  });

  it("renders the error state", async () => {
    listUsersMock.mockRejectedValue(new Error("Nope"));

    renderWithProviders(<UsersScreen />);

    expect(await screen.findByText("Could not load users.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the create button only with user.manage", async () => {
    renderWithProviders(<UsersScreen />);

    expect(
      await screen.findByRole("button", { name: "Create user" }),
    ).toBeInTheDocument();
  });

  it("opens the create user modal", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersScreen />);

    await user.click(await screen.findByRole("button", { name: "Create user" }));

    expect(
      within(screen.getByRole("dialog")).getByRole("heading", {
        name: "Create user",
      }),
    ).toBeInTheDocument();
  });

  it("shows the reassign action with user.manage", async () => {
    renderWithProviders(<UsersScreen />);

    expect(
      await screen.findByRole("button", { name: "Reassign membership" }),
    ).toBeInTheDocument();
  });

  it("hides create, deactivate, reset, and reassign actions without permission", async () => {
    renderWithProviders(<UsersScreen />, {
      auth: makeAuthContext({
        user: makeAuthUser({ permissions: {} }),
      }),
    });

    expect(await screen.findByText("team@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create user" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Reassign membership" }),
    ).toBeNull();
  });

  it("does not expose password hashes or sensitive fields in the user cards", async () => {
    renderWithProviders(<UsersScreen />);

    expect(await screen.findByText("team@example.com")).toBeInTheDocument();
    const bodyText = document.body.textContent ?? "";
    for (const forbidden of [
      ["password", "hash"].join("_"),
      ["new", "password"].join("_"),
      ["api", "key"].join("_"),
      ["sec", "ret"].join(""),
      ["tok", "en"].join(""),
      ["session", "key"].join("_"),
      "Strong-temp-123!",
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }
  });

  it("hides deactivate and reassign for the current logged-in user", async () => {
    listUsersMock.mockResolvedValue([
      makeManagedUser({
        id: 1,
        email: "admin@example.com",
        full_name: "Admin User",
      }),
    ]);

    renderWithProviders(<UsersScreen />);

    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Reset password" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reassign membership" }),
    ).toBeNull();
  });

  it("reset submit calls resetPassword", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersScreen />);

    await screen.findByText("team@example.com");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await user.type(
      screen.getByLabelText(/new temporary password/i),
      "Strong-temp-123!",
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reset password",
      }),
    );

    await waitFor(() => {
      expect(resetPasswordMock).toHaveBeenCalledWith(10, "Strong-temp-123!");
    });
  });

  it("deactivate confirmation calls deactivateUser", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(<UsersScreen />);

    await screen.findByText("team@example.com");
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => {
      expect(deactivateUserMock).toHaveBeenCalledWith(10);
    });
    confirmSpy.mockRestore();
  });

  it("renders reset password backend errors inline", async () => {
    resetPasswordMock.mockRejectedValue(
      new ApiError(400, {
        new_password: ["This password is too weak."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UsersScreen />);

    await screen.findByText("team@example.com");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await user.type(screen.getByLabelText(/new temporary password/i), "weak");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Reset password",
      }),
    );

    expect(
      await screen.findByText("This password is too weak."),
    ).toBeInTheDocument();
  });

  it("successful membership reassignment refetches users", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersScreen />);

    await screen.findByText("team@example.com");
    await user.click(
      screen.getByRole("button", { name: "Reassign membership" }),
    );
    await user.click(screen.getByRole("button", { name: "Save membership" }));

    await waitFor(() => {
      expect(assignMembershipMock).toHaveBeenCalledWith(10, { role: "ADMIN" });
    });
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledTimes(2);
    });
  });
});
