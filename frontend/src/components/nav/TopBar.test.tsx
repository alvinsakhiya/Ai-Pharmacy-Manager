import { screen } from "@testing-library/react";
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

function renderTopBar(
  authOverrides: Partial<AuthContextValue> = {},
  route = "/",
) {
  const auth = makeAuthContext({
    user: makeUser(),
    logout: vi.fn().mockResolvedValue(undefined),
    ...authOverrides,
  });

  renderWithProviders(<TopBar />, { auth, route });

  return auth;
}

describe("TopBar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAlertsMock.mockResolvedValue(emptyAlerts());
  });

  it("renders the global scope label", () => {
    renderTopBar({ user: makeUser({ role: "ADMIN" }) });

    expect(screen.getByText("Global access")).toBeInTheDocument();
  });

  it("renders a pharmacy scope label", () => {
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

  it("renders the workspace section label", () => {
    renderTopBar();

    expect(screen.getByText("Workspace")).toBeInTheDocument();
  });

  it("uses a solid app shell surface without glass utilities", () => {
    renderTopBar();

    const header = document.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header?.className).toContain("bg-canvas");

    for (const forbidden of [
      /backdrop-blur/,
      /bg-canvas\//,
      /from-canvas\//,
      /to-canvas\//,
      /radial-gradient/,
      /rgba\(/,
    ]) {
      expect(header?.className ?? "").not.toMatch(forbidden);
    }
  });

  it("uses the clearer Pharmacist Reviews section label", () => {
    renderTopBar({}, "/reviews");

    expect(screen.getByText("Pharmacist Reviews")).toBeInTheDocument();
  });

  it("renders the notification centre bell", async () => {
    renderTopBar();

    expect(
      await screen.findByRole("button", { name: "Open notification centre" }),
    ).toBeInTheDocument();
  });
});
