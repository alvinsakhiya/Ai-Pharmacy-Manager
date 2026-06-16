import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  AuthContext,
  type AuthContextValue,
} from "../../auth/AuthContext";
import type { MePayload } from "../../types/auth";
import { LoginScreen } from "./LoginScreen";

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

function renderLoginScreen(authOverrides: Partial<AuthContextValue> = {}) {
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
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    </AuthContext.Provider>,
  );

  return auth;
}

describe("LoginScreen", () => {
  it("renders email and password fields", () => {
    renderLoginScreen();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("successful submit calls login", async () => {
    const login = vi.fn().mockResolvedValue({ ok: true, user: makeUser() });
    const user = userEvent.setup();
    renderLoginScreen({ login });

    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("admin@example.com", "correct-password");
    });
  });

  it("failed login shows generic error", async () => {
    const login = vi.fn().mockResolvedValue({
      ok: false,
      error: "Unable to sign in with those credentials.",
    });
    const user = userEvent.setup();
    renderLoginScreen({ login });

    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText(/unable to sign in with those credentials/i),
    ).toBeInTheDocument();
  });
});
