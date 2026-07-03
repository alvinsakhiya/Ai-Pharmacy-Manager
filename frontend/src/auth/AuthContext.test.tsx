import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_EXPIRED_EVENT } from "../lib/apiClient";
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
const logoutMock = vi.mocked(authApi.logout);

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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderAuth(ui: React.ReactElement, queryClient = createQueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

function LoginHarness() {
  const { login, logout, user } = useAuth();

  return (
    <div>
      <p data-testid="current-user">{user?.email ?? "No user"}</p>
      <button
        type="button"
        onClick={() => void login("pharmacist@demo.local", "DemoPass!2026")}
      >
        Sign in
      </button>
      <button type="button" onClick={() => void logout()}>
        Sign out
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

    renderAuth(<LoginHarness />);

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

    renderAuth(<ErrorHarness />);

    await waitFor(() => {
      expect(getMeMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid credentials.")).toBeInTheDocument();
    expect(getMeMock).toHaveBeenCalledTimes(1);
  });

  it("clears cached query data from before login so a new account starts clean", async () => {
    const user = userEvent.setup();
    getMeMock.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser());
    loginMock.mockResolvedValue({
      data: makeUser(),
      ok: true,
      status: 200,
    });

    const queryClient = createQueryClient();
    queryClient.setQueryData(["patients"], [{ id: 9, name: "Stale Patient" }]);
    renderAuth(<LoginHarness />, queryClient);

    await waitFor(() => {
      expect(getMeMock).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent(
        "pharmacist@demo.local",
      );
    });
    expect(queryClient.getQueryData(["patients"])).toBeUndefined();
  });

  it("logout clears the user and all cached query data", async () => {
    const user = userEvent.setup();
    getMeMock.mockResolvedValue(makeUser());
    logoutMock.mockResolvedValue(undefined);

    const queryClient = createQueryClient();
    renderAuth(<LoginHarness />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent(
        "pharmacist@demo.local",
      );
    });

    queryClient.setQueryData(["patients"], [{ id: 9, name: "Stale Patient" }]);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("No user");
    });
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(["patients"])).toBeUndefined();
  });

  it("logout still ends the local session when the server call fails", async () => {
    const user = userEvent.setup();
    getMeMock.mockResolvedValue(makeUser());
    logoutMock.mockRejectedValue(new Error("network down"));

    const queryClient = createQueryClient();
    renderAuth(<LoginHarness />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent(
        "pharmacist@demo.local",
      );
    });

    queryClient.setQueryData(["patients"], [{ id: 9, name: "Stale Patient" }]);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("No user");
    });
    expect(queryClient.getQueryData(["patients"])).toBeUndefined();
  });

  it("session-expired event signs the user out and purges cached data", async () => {
    getMeMock.mockResolvedValue(makeUser());

    const queryClient = createQueryClient();
    renderAuth(<LoginHarness />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent(
        "pharmacist@demo.local",
      );
    });

    queryClient.setQueryData(["patients"], [{ id: 9, name: "Stale Patient" }]);

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByTestId("current-user")).toHaveTextContent("No user");
    });
    expect(queryClient.getQueryData(["patients"])).toBeUndefined();
  });
});
