import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthContextValue,
} from "../../auth/AuthContext";
import type { MePayload } from "../../types/auth";
import { TopBar } from "./TopBar";

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

function renderTopBar(authOverrides: Partial<AuthContextValue> = {}) {
  const auth: AuthContextValue = {
    user: makeUser(),
    loading: false,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn(),
    refreshMe: vi.fn(),
    ...authOverrides,
  };

  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

  return auth;
}

describe("TopBar", () => {
  it("renders user name, role, and scope label", () => {
    renderTopBar({
      user: makeUser({
        full_name: "Priya Admin",
        role: "ADMIN",
      }),
    });

    expect(screen.getByText("Priya Admin")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByText("Global access")).toBeInTheDocument();
  });

  it("renders email when full name is blank", () => {
    renderTopBar({
      user: makeUser({
        full_name: "",
        email: "fallback@example.com",
      }),
    });

    expect(screen.getByText("fallback@example.com")).toBeInTheDocument();
  });

  it("renders pharmacy scope label", () => {
    renderTopBar({
      user: makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [42],
        },
        pharmacies: [{ id: 42, name: "Central Pharmacy" }],
      }),
    });

    expect(screen.getByText("Central Pharmacy")).toBeInTheDocument();
  });

  it("logout button calls logout", async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);
    renderTopBar({ logout });

    await user.click(screen.getByRole("button", { name: /logout/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
  });
});
