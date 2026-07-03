import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthContextValue,
} from "../auth/AuthContext";
import type { MePayload } from "../types/auth";
import { ProtectedRoute } from "./ProtectedRoute";

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

function renderProtectedRoute(authOverrides: Partial<AuthContextValue>) {
  const auth: AuthContextValue = {
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
    refreshMe: vi.fn(),
    ...authOverrides,
  };

  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/change-password"
            element={<div>Change password page</div>}
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  it("shows a loading state while the session is being restored", () => {
    renderProtectedRoute({ loading: true, user: null });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).toBeNull();
    expect(screen.queryByText("Login page")).toBeNull();
  });

  it("unauthenticated user redirects to /login", async () => {
    renderProtectedRoute({ user: null });

    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("authenticated user with must_change_password=true redirects to /change-password", async () => {
    renderProtectedRoute({
      user: makeUser({ must_change_password: true }),
    });

    expect(await screen.findByText("Change password page")).toBeInTheDocument();
  });

  it("does not render shell content when password change is required", async () => {
    renderProtectedRoute({
      user: makeUser({ must_change_password: true }),
    });

    expect(await screen.findByText("Change password page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).toBeNull();
  });

  it("normal authenticated user renders protected content", () => {
    renderProtectedRoute({ user: makeUser() });

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
