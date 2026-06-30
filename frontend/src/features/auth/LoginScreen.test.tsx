import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
    expect(
      screen.getByLabelText(/password/i, { selector: "input" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("renders the modern AI Pharmacy Manager brand title", () => {
    renderLoginScreen();

    expect(
      screen.getByRole("heading", {
        name: "Welcome to AI Pharmacy Manager",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
    expect(screen.getByText("Operational workspace")).toBeInTheDocument();
    expect(
      document.querySelector('img[src*="ai-pharmacy-manager-logo-header"]'),
    ).toBeNull();
  });

  it("uses safe SaaS login copy without unsafe wording", () => {
    renderLoginScreen();

    expect(document.body).toHaveTextContent("Human review required");
    expect(document.body).toHaveTextContent("Role-based access");
    expect(document.body).toHaveTextContent("Audit trail");
    expect(document.body).not.toHaveTextContent(
      /Acme|NHS|NCRS|clinical recommendation|AI decided|automatic ordering|automatic transfer|automatic dispensing|guaranteed forecast/i,
    );

    const loginSection = screen.getByLabelText("AI Pharmacy Manager login");
    const loginMarkup = loginSection.outerHTML;
    for (const forbidden of [
      /backdrop-blur/,
      /blur-3xl/,
    ]) {
      expect(loginMarkup).not.toMatch(forbidden);
    }
  });

  it("renders decorative badges outside the form accessibility flow", () => {
    renderLoginScreen();

    const badges = screen.getByTestId("login-decorative-badges");
    expect(badges).toHaveAttribute("aria-hidden", "true");
    expect(badges).toHaveTextContent("MDS");
    expect(badges).toHaveTextContent("Stock");
    expect(badges).toHaveTextContent("Review");
    expect(badges).toHaveTextContent("FEFO");
    expect(screen.queryByRole("button", { name: /mds|stock|review|fefo/i }))
      .not.toBeInTheDocument();
  });

  it("successful submit calls login with trimmed email and preserved password", async () => {
    const login = vi.fn().mockResolvedValue({ ok: true, user: makeUser() });
    const user = userEvent.setup();
    renderLoginScreen({ login });

    await user.type(screen.getByLabelText(/email/i), "  admin@example.com  ");
    await user.type(
      screen.getByLabelText(/password/i, { selector: "input" }),
      " DemoPass!2026 ",
    );
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("admin@example.com", " DemoPass!2026 ");
    });
  });

  it("successful login redirects into the app", async () => {
    const login = vi.fn().mockResolvedValue({ ok: true, user: makeUser() });
    const user = userEvent.setup();

    render(
      <AuthContext.Provider
        value={{
          user: null,
          loading: false,
          login,
          logout: vi.fn(),
          changePassword: vi.fn(),
          refreshMe: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/" element={<p>Dashboard route</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(
      screen.getByLabelText(/password/i, { selector: "input" }),
      "DemoPass!2026",
    );
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText("Dashboard route")).toBeInTheDocument();
  });

  it("does not submit empty credentials", async () => {
    const login = vi.fn();
    const user = userEvent.setup();
    renderLoginScreen({ login });

    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(login).not.toHaveBeenCalled();
  });

  it("failed login shows generic error", async () => {
    const login = vi.fn().mockResolvedValue({
      ok: false,
      error: "Unable to sign in with those credentials.",
    });
    const user = userEvent.setup();
    renderLoginScreen({ login });

    await user.type(screen.getByLabelText(/email/i), "admin@example.com");
    await user.type(
      screen.getByLabelText(/password/i, { selector: "input" }),
      "wrong-password",
    );
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByText(/unable to sign in with those credentials/i),
    ).toBeInTheDocument();
  });
});
