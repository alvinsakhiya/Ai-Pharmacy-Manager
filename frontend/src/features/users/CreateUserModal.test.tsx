import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { ApiError, type ManagedUser } from "./usersApi";
import { CreateUserModal } from "./CreateUserModal";
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

const createUserMock = vi.mocked(usersApi.createUser);
const listPharmaciesForPickerMock = vi.mocked(usersApi.listPharmaciesForPicker);

function createdUser(): ManagedUser {
  return {
    id: 99,
    email: "created@example.com",
    full_name: "Created User",
    is_active: true,
    must_change_password: true,
    role: "DISPENSER",
    pharmacy: { id: 7, name: "North Pharmacy" },
    date_joined: "2026-06-17T09:00:00Z",
  };
}

describe("CreateUserModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createUserMock.mockResolvedValue(createdUser());
    listPharmaciesForPickerMock.mockResolvedValue([
      { id: 7, name: "North Pharmacy", group: 1 },
      { id: 8, name: "South Pharmacy", group: 1 },
    ]);
  });

  it("for pharmacist shows only PHARMACIST and DISPENSER roles with own pharmacy read-only", () => {
    renderWithProviders(<CreateUserModal isOpen onClose={vi.fn()} />, {
      auth: makeAuthContext({
        user: makeAuthUser({
          role: "PHARMACIST",
          scope: {
            is_global: false,
            group_ids: [],
            pharmacy_ids: [7],
          },
          pharmacies: [{ id: 7, name: "North Pharmacy" }],
        }),
      }),
    });

    const roleSelect = screen.getByLabelText("Role");
    expect(within(roleSelect).getByRole("option", { name: "Pharmacist" }))
      .toBeInTheDocument();
    expect(
      within(roleSelect).getByRole("option", { name: "Dispenser" }),
    ).toBeInTheDocument();
    expect(
      within(roleSelect).queryByRole("option", { name: "Admin" }),
    ).toBeNull();
    expect(screen.getByText("North Pharmacy")).toBeInTheDocument();
    expect(listPharmaciesForPickerMock).not.toHaveBeenCalled();
  });

  it("for admin shows all roles and toggles the pharmacy picker", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateUserModal isOpen onClose={vi.fn()} />);

    const roleSelect = screen.getByLabelText("Role");
    expect(within(roleSelect).getByRole("option", { name: "Admin" }))
      .toBeInTheDocument();
    expect(
      within(roleSelect).getByRole("option", { name: "Superintendent" }),
    ).toBeInTheDocument();
    expect(
      within(roleSelect).getByRole("option", { name: "Stock employee" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Pharmacy")).toBeNull();

    await user.selectOptions(roleSelect, "PHARMACIST");

    expect(await screen.findByLabelText("Pharmacy")).toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: "North Pharmacy" }),
    ).toBeInTheDocument();

    await user.selectOptions(roleSelect, "ADMIN");
    expect(screen.queryByLabelText("Pharmacy")).toBeNull();
  });

  it("create submit calls createUser", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateUserModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "created@example.com");
    await user.type(screen.getByLabelText("Full name"), "Created User");
    await user.type(
      screen.getByLabelText(/temporary password/i),
      "Strong-temp-123!",
    );
    await user.selectOptions(screen.getByLabelText("Role"), "DISPENSER");
    await user.selectOptions(await screen.findByLabelText("Pharmacy"), "7");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        email: "created@example.com",
        full_name: "Created User",
        password: "Strong-temp-123!",
        role: "DISPENSER",
        pharmacy_id: 7,
      });
    });
  });

  it("renders backend duplicate email and weak password errors inline", async () => {
    createUserMock.mockRejectedValue(
      new ApiError("Bad request", 400, {
        email: ["A user with this email already exists."],
        password: ["This password is too common."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CreateUserModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "dupe@example.com");
    await user.type(screen.getByLabelText("Full name"), "Duplicate User");
    await user.type(screen.getByLabelText(/temporary password/i), "password");
    await user.selectOptions(screen.getByLabelText("Role"), "DISPENSER");
    await user.selectOptions(await screen.findByLabelText("Pharmacy"), "7");
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText("A user with this email already exists."),
    ).toBeInTheDocument();
    expect(screen.getByText("This password is too common.")).toBeInTheDocument();
  });
});
