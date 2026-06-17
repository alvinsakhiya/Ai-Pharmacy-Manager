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
  };
});

const listUsersMock = vi.mocked(usersApi.listUsers);
const resetPasswordMock = vi.mocked(usersApi.resetPassword);

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
    resetPasswordMock.mockResolvedValue({ detail: "Password reset." });
  });

  it("renders user rows from the mocked list", async () => {
    renderWithProviders(<UsersScreen />);

    expect(await screen.findByText("team@example.com")).toBeInTheDocument();
    expect(screen.getByText("Team Member")).toBeInTheDocument();
    expect(screen.getByText("Central Pharmacy")).toBeInTheDocument();
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

  it("hides create, deactivate, and reset actions without permission", async () => {
    renderWithProviders(<UsersScreen />, {
      auth: makeAuthContext({
        user: makeAuthUser({ permissions: {} }),
      }),
    });

    expect(await screen.findByText("team@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create user" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();
  });

  it("hides deactivate for the current logged-in user", async () => {
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

  it("renders reset password backend errors inline", async () => {
    resetPasswordMock.mockRejectedValue(
      new ApiError("Bad request", 400, {
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
});
