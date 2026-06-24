import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthContextValue,
} from "../../auth/AuthContext";
import type { MePayload } from "../../types/auth";
import { Sidebar } from "./Sidebar";

function makeUser(overrides: Partial<MePayload> = {}): MePayload {
  return {
    id: 1,
    email: "admin@example.com",
    full_name: "Admin User",
    must_change_password: false,
    role: "ADMIN",
    scope: {
      is_global: true,
      group_ids: [],
      pharmacy_ids: [],
    },
    pharmacies: [],
    permissions: {},
    ...overrides,
  };
}

function renderSidebar(user: MePayload) {
  const logout = vi.fn().mockResolvedValue(undefined);
  const auth: AuthContextValue = {
    user,
    loading: false,
    login: vi.fn(),
    logout,
    changePassword: vi.fn(),
    refreshMe: vi.fn(),
  };

  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

  return { logout };
}

describe("Sidebar", () => {
  it("admin/global user sees Dashboard, Users, Organisation, and Audit Log", () => {
    renderSidebar(
      makeUser({
        permissions: {
          "user.manage": true,
          "group.manage": true,
          "pharmacy.manage": true,
          "audit.view": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Organisation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
  });

  it("pharmacist with user.manage sees Dashboard and Users only", () => {
    renderSidebar(
      makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "user.manage": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organisation" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Audit Log" })).toBeNull();
  });

  it("superintendent with audit.view sees Dashboard and Audit Log only", () => {
    renderSidebar(
      makeUser({
        role: "SUPERINTENDENT",
        scope: {
          is_global: false,
          group_ids: [1],
          pharmacy_ids: [1, 2],
        },
        permissions: {
          "audit.view": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Organisation" })).toBeNull();
  });

  it("user with medication.view sees Medication Library", () => {
    renderSidebar(
      makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "medication.view": true,
        },
      }),
    );

    expect(
      screen.getByRole("link", { name: "Medication Library" }),
    ).toBeInTheDocument();
  });

  it("user with stock.view sees Inventory", () => {
    renderSidebar(
      makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "stock.view": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Inventory" })).toBeInTheDocument();
  });

  it.each([
    ["ADMIN", "Admin User"],
    ["PHARMACIST", "Pharmacist User"],
    ["DISPENSER", "Dispenser User"],
  ])("%s with patient.view sees Patients", (role, fullName) => {
    renderSidebar(
      makeUser({
        role,
        full_name: fullName,
        scope: {
          is_global: role === "ADMIN",
          group_ids: [],
          pharmacy_ids: role === "ADMIN" ? [] : [1],
        },
        permissions: {
          "patient.view": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Patients" })).toBeInTheDocument();
  });

  it.each(["SUPERINTENDENT", "STOCK_EMPLOYEE"])(
    "%s without patient.view does not see Patients",
    (role) => {
      renderSidebar(
        makeUser({
          role,
          scope: {
            is_global: false,
            group_ids: [1],
            pharmacy_ids: [1, 2],
          },
        }),
      );

      expect(screen.queryByRole("link", { name: "Patients" })).toBeNull();
    },
  );

  it("user without stock.view does not see Inventory", () => {
    renderSidebar(makeUser());

    expect(screen.queryByRole("link", { name: "Inventory" })).toBeNull();
  });

  it("user without medication.view does not see Medication Library", () => {
    renderSidebar(makeUser());

    expect(
      screen.queryByRole("link", { name: "Medication Library" }),
    ).toBeNull();
  });

  it("future items appear disabled and non-clickable", () => {
    renderSidebar(makeUser());

    const stockItem = screen.getByText("Dosette/MDS");

    expect(stockItem).toHaveAttribute("aria-disabled", "true");
    expect(stockItem.closest("a")).toBeNull();
  });

  it("renders the signed-in user profile with a logout control", () => {
    renderSidebar(makeUser({ full_name: "Andrew Carnegie", role: "ADMIN" }));

    expect(screen.getByText("Andrew Carnegie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("logout button calls logout", async () => {
    const user = userEvent.setup();
    const { logout } = renderSidebar(makeUser());

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
  });
});
