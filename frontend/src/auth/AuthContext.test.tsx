import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MePayload } from "../types/auth";
import { AuthProvider, useAuth } from "./AuthContext";
import * as authApi from "./authApi";

vi.mock("./authApi", () => ({
  changePassword: vi.fn(),
  getCsrf: vi.fn(),
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const getCsrfMock = vi.mocked(authApi.getCsrf);
const getMeMock = vi.mocked(authApi.getMe);
const loginMock = vi.mocked(authApi.login);

function makeUser(overrides: Partial<MePayload> = {}): MePayload {
  return {
    email: "pharmacist@demo.local",
    full_name: "Demo Pharmacist",
    id: 3,
    must_change_password: false,
    permissions: {},
    pharmacies: [{ id: 1, name: "JMW Sutton" }],
    role: "PHARMACIST",
    scope: {
      group_ids: [],
      is_global: false,
      pharmacy_ids: [1],
    },
    ...overrides,
  };
}

function LoginHarness() {
  const { login, user } = useAuth();

  return (
    <div>
      <p data-testid="current-user">{user?.email ?? "No user"}</p>
      <button
        type="button"
        onClick={() => void login("pharmacist@demo.local", "DemoPass!2026")}
      >
        Sign in
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCsrfMock.mockResolvedValue(undefined);
  });

  it("confirms the session through auth me after successful login", async () => {
    const user = userEvent.setup();
    getMeMock.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser());
    loginMock.mockResolvedValue({
      data: makeUser(),
      ok: true,
      status: 200,
    });

    render(
      <AuthProvider>
        <LoginHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getMeMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        "pharmacist@demo.local",
        "DemoPass!2026",
      );
      expect(getMeMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("current-user")).toHaveTextContent(
        "pharmacist@demo.local",
      );
    });
  });

  it("uses safe backend detail when login is rejected", async () => {
    const user = userEvent.setup();
    getMeMock.mockResolvedValueOnce(null);
    loginMock.mockResolvedValue({
      data: { detail: "Invalid credentials." },
      ok: false,
      status: 400,
    });

    function ErrorHarness() {
      const { login } = useAuth();
      const [message, setMessage] = useState("");

      return (
        <div>
          <button
            type="button"
            onClick={() =>
              void login("pharmacist@demo.local", "wrong-password").then(
                (result) => setMessage(result.error ?? ""),
              )
            }
          >
            Sign in
          </button>
          <p>{message}</p>
        </div>
      );
    }

    render(
      <AuthProvider>
        <ErrorHarness />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(getMeMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid credentials.")).toBeInTheDocument();
    expect(getMeMock).toHaveBeenCalledTimes(1);
  });
});
