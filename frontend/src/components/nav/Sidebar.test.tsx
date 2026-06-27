import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeAuthContext, renderWithProviders } from "../../test/providers";
import type { MePayload } from "../../types/auth";
import * as notificationsApi from "../../features/notifications/notificationsApi";
import { Sidebar } from "./Sidebar";

vi.mock("../../features/notifications/notificationsApi", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../features/notifications/notificationsApi")
  >();
  return {
    ...actual,
    getWorkQueue: vi.fn(),
  };
});

const getWorkQueueMock = vi.mocked(notificationsApi.getWorkQueue);

const emptyWorkQueue = {
  generated_at: "2026-06-26T09:30:00Z",
  summary: {
    total: 0,
    urgent: 0,
    due_soon: 0,
    waiting_check: 0,
    stock_action: 0,
    reviews: 0,
  },
  items: [],
};

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

function renderSidebar(user: MePayload) {
  const logout = vi.fn().mockResolvedValue(undefined);
  const auth = makeAuthContext({
    user,
    logout,
  });

  renderWithProviders(<Sidebar />, { auth });

  return { logout };
}

describe("Sidebar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getWorkQueueMock.mockResolvedValue(emptyWorkQueue);
  });

  it("admin/global user sees Dashboard, Users, Organisation, and Audit Log", () => {
    renderSidebar(
      makeUser({
        permissions: {
          "user.manage": true,
          "group.manage": true,
          "pharmacy.manage": true,
          "audit.view": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Organisation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
  });

  it("pharmacist with user.manage sees Dashboard and Users only", () => {
    renderSidebar(
      makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "user.manage": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Organisation" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Audit Log" })).toBeNull();
  });

  it("superintendent with audit.view sees Dashboard and Audit Log only", () => {
    renderSidebar(
      makeUser({
        role: "SUPERINTENDENT",
        scope: {
          is_global: false,
          group_ids: [1],
          pharmacy_ids: [1, 2],
        },
        permissions: {
          "audit.view": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Organisation" })).toBeNull();
  });

  it("does not show Medication Catalogue in daily navigation for medication managers", () => {
    renderSidebar(
      makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "medication.manage": true,
        },
      }),
    );

    expect(
      screen.queryByRole("link", { name: "Medication Catalogue" }),
    ).toBeNull();
  });

  it("user with stock.view sees Inventory", () => {
    renderSidebar(
      makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "stock.view": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Inventory" })).toBeInTheDocument();
  });

  it("user with review.view sees Pharmacist Reviews at the reviews route", () => {
    renderSidebar(
      makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "review.view": true,
        },
      }),
    );

    expect(
      screen.getByRole("link", { name: "Pharmacist Reviews" }),
    ).toHaveAttribute("href", "/reviews");
  });

  it.each(["stock.view", "blister.view", "review.view"])(
    "user with %s sees Work Queue",
    (permission) => {
      renderSidebar(
        makeUser({
          role: "PHARMACIST",
          scope: {
            is_global: false,
            group_ids: [],
            pharmacy_ids: [1],
          },
          permissions: {
            [permission]: true,
          },
        }),
      );

      expect(screen.getByRole("link", { name: /Work Queue/ })).toHaveAttribute(
        "href",
        "/work-queue",
      );
    },
  );

  it("user without work queue permissions does not see Work Queue", () => {
    renderSidebar(makeUser());

    expect(screen.queryByRole("link", { name: /Work Queue/ })).toBeNull();
    expect(getWorkQueueMock).not.toHaveBeenCalled();
  });

  it("shows a Work Queue badge with the visible task count", async () => {
    getWorkQueueMock.mockResolvedValueOnce({
      ...emptyWorkQueue,
      summary: {
        total: 7,
        urgent: 1,
        due_soon: 2,
        waiting_check: 1,
        stock_action: 2,
        reviews: 1,
      },
    });
    renderSidebar(
      makeUser({
        role: "PHARMACIST",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "blister.view": true,
        },
      }),
    );

    expect(await screen.findByLabelText("7 tasks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Work Queue/ })).toHaveAttribute(
      "href",
      "/work-queue",
    );
  });

  it.each([
    ["ADMIN", "Admin User"],
    ["PHARMACIST", "Pharmacist User"],
    ["DISPENSER", "Dispenser User"],
  ])("%s with patient.view sees Patients", (role, fullName) => {
    renderSidebar(
      makeUser({
        role,
        full_name: fullName,
        scope: {
          is_global: role === "ADMIN",
          group_ids: [],
          pharmacy_ids: role === "ADMIN" ? [] : [1],
        },
        permissions: {
          "patient.view": true,
        },
      }),
    );

    expect(screen.getByRole("link", { name: "Patients" })).toBeInTheDocument();
  });

  it.each(["SUPERINTENDENT", "STOCK_EMPLOYEE"])(
    "%s without patient.view does not see Patients",
    (role) => {
      renderSidebar(
        makeUser({
          role,
          scope: {
            is_global: false,
            group_ids: [1],
            pharmacy_ids: [1, 2],
          },
        }),
      );

      expect(screen.queryByRole("link", { name: "Patients" })).toBeNull();
    },
  );

  it("user without stock.view does not see Inventory", () => {
    renderSidebar(makeUser());

    expect(screen.queryByRole("link", { name: "Inventory" })).toBeNull();
  });

  it("user with medication.view but not medication.manage does not see Medication Catalogue", () => {
    renderSidebar(
      makeUser({
        role: "DISPENSER",
        scope: {
          is_global: false,
          group_ids: [],
          pharmacy_ids: [1],
        },
        permissions: {
          "medication.view": true,
        },
      }),
    );

    expect(
      screen.queryByRole("link", { name: "Medication Catalogue" }),
    ).toBeNull();
  });

  it("does not render stale future navigation items", () => {
    renderSidebar(makeUser());

    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(screen.queryByText("Dosette/MDS")).toBeNull();
    expect(screen.queryByText("Clinical Review")).toBeNull();
    expect(screen.queryByText("Notifications")).toBeNull();
  });

  it("renders the signed-in user profile with a logout control", () => {
    renderSidebar(makeUser({ full_name: "Andrew Carnegie", role: "ADMIN" }));

    expect(screen.getByText("Andrew Carnegie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("logout button calls logout", async () => {
    const user = userEvent.setup();
    const { logout } = renderSidebar(makeUser());

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
  });
});
