import { render, screen } from "@testing-library/react";
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
  const auth: AuthContextValue = {
    user,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
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

  it("future items appear disabled and non-clickable", () => {
    renderSidebar(makeUser());

    const stockItem = screen.getByText("Stock");

    expect(stockItem).toHaveAttribute("aria-disabled", "true");
    expect(stockItem.closest("a")).toBeNull();
  });
});
