import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "../../auth/AuthContext";
import {
  makeAuthContext,
  renderWithProviders,
} from "../../test/providers";
import type { MePayload } from "../../types/auth";
import type { AlertsResponse } from "../../features/notifications/notificationsApi";
import * as notificationsApi from "../../features/notifications/notificationsApi";
import { TopBar } from "./TopBar";

vi.mock("../../features/notifications/notificationsApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../features/notifications/notificationsApi")>();
  return {
    ...actual,
    getAlerts: vi.fn(),
    dismissAlert: vi.fn(),
    clearAlerts: vi.fn(),
  };
});

const getAlertsMock = vi.mocked(notificationsApi.getAlerts);

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

function emptyAlerts(): AlertsResponse {
  return {
    generated_at: "2026-06-22T10:00:00Z",
    summary: {
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      by_category: {
        stock: 0,
        dosette: 0,
      },
    },
    alerts: [],
  };
}

function renderTopBar(authOverrides: Partial<AuthContextValue> = {}) {
  const auth = makeAuthContext({
    user: makeUser(),
    logout: vi.fn().mockResolvedValue(undefined),
    ...authOverrides,
  });

  renderWithProviders(<TopBar />, { auth });

  return auth;
}

describe("TopBar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAlertsMock.mockResolvedValue(emptyAlerts());
  });

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

  it("renders the notification centre bell", async () => {
    renderTopBar();

    expect(
      await screen.findByRole("button", { name: "Open notification centre" }),
    ).toBeInTheDocument();
  });
});
