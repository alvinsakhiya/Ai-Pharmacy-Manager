import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MePayload } from "../types/auth";
import {
  AuthContext,
  type AuthContextValue,
} from "./AuthContext";
import { usePermissions } from "./usePermissions";

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
    permissions: {
      "user.manage": true,
    },
    ...overrides,
  };
}

function Probe({ action }: { action: string }) {
  const { can } = usePermissions();
  return <p>{can(action) ? "allowed" : "denied"}</p>;
}

function renderProbe(user: MePayload | null, action: string) {
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
      <Probe action={action} />
    </AuthContext.Provider>,
  );
}

describe("usePermissions", () => {
  it("returns true for an enabled permission flag", () => {
    renderProbe(makeUser(), "user.manage");

    expect(screen.getByText("allowed")).toBeInTheDocument();
  });

  it("returns false for an unknown action", () => {
    renderProbe(makeUser(), "group.manage");

    expect(screen.getByText("denied")).toBeInTheDocument();
  });

  it("returns false when there is no user", () => {
    renderProbe(null, "user.manage");

    expect(screen.getByText("denied")).toBeInTheDocument();
  });
});
