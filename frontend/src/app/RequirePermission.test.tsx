import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthContextValue,
} from "../auth/AuthContext";
import type { MePayload } from "../types/auth";
import { RequirePermission } from "./RequirePermission";

function makeUser(overrides: Partial<MePayload> = {}): MePayload {
  return {
    id: 1,
    email: "dispenser@demo.local",
    full_name: "Demo Dispenser",
    must_change_password: false,
    role: "DISPENSER",
    scope: {
      is_global: false,
      group_ids: [],
      pharmacy_ids: [1],
    },
    pharmacies: [{ id: 1, name: "JMW Sutton" }],
    permissions: {},
    ...overrides,
  };
}

function renderWithPermissions(
  permissions: Record<string, boolean>,
  anyOf: string[],
) {
  const auth: AuthContextValue = {
    user: makeUser({ permissions }),
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshMe: vi.fn(),
  };

  render(
    <AuthContext.Provider value={auth}>
      <RequirePermission anyOf={anyOf}>
        <div>Restricted content</div>
      </RequirePermission>
    </AuthContext.Provider>,
  );
}

describe("RequirePermission", () => {
  it("renders children when any required permission is granted", () => {
    renderWithPermissions({ "stock.view": true }, ["stock.view"]);

    expect(screen.getByText("Restricted content")).toBeInTheDocument();
  });

  it("shows access denied without rendering restricted content", () => {
    renderWithPermissions({}, ["user.manage"]);

    expect(
      screen.getByText("You don't have access to this section."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Restricted content")).toBeNull();
  });

  it("denies when granted permissions do not overlap the required set", () => {
    renderWithPermissions({ "stock.view": true }, ["user.manage"]);

    expect(
      screen.getByText("You don't have access to this section."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Restricted content")).toBeNull();
  });
});
