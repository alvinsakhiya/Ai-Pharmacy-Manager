import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { AuditScreen } from "./AuditScreen";
import type { AuditEvent, Paginated } from "./auditApi";
import * as auditApi from "./auditApi";

vi.mock("./auditApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auditApi")>();
  return {
    ...actual,
    listAuditEvents: vi.fn(),
  };
});

const listAuditEventsMock = vi.mocked(auditApi.listAuditEvents);

function makeAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 1,
    action: "USER_CREATED",
    actor_email: "admin@example.com",
    actor_role: "ADMIN",
    group: 2,
    pharmacy: 3,
    target_type: "User",
    target_id: "42",
    metadata: { role: "DISPENSER" },
    ip_address: "127.0.0.1",
    user_agent: "vitest",
    created_at: "2026-06-17T09:00:00Z",
    ...overrides,
  };
}

function makePaginatedAuditEvents(
  overrides: Partial<Paginated<AuditEvent>> = {},
): Paginated<AuditEvent> {
  return {
    count: 1,
    next: null,
    previous: null,
    results: [makeAuditEvent()],
    ...overrides,
  };
}

function auditAuth(role = "ADMIN") {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: { "audit.view": true },
      role,
    }),
  });
}

describe("AuditScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listAuditEventsMock.mockResolvedValue(makePaginatedAuditEvents());
  });

  it("renders rows from a mocked paginated response", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({
        count: 1,
        results: [
          makeAuditEvent({
            id: 7,
            action: "PASSWORD_RESET",
            actor_email: "pharmacist@example.com",
            actor_role: "PHARMACIST",
            target_type: "User",
            target_id: "88",
            metadata: { reason: "temporary reset" },
          }),
        ],
      }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByText("PASSWORD_RESET")).toBeInTheDocument();
    expect(screen.getByText("pharmacist@example.com")).toBeInTheDocument();
    expect(screen.getByText("PHARMACIST")).toBeInTheDocument();
    expect(screen.getByText("User #88")).toBeInTheDocument();
    expect(screen.getByText('{"reason":"temporary reset"}')).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1")).toBeInTheDocument();
  });

  it("reads data from results instead of a bare array", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({
        count: 2,
        results: [
          makeAuditEvent({ id: 1, action: "LOGIN" }),
          makeAuditEvent({ id: 2, action: "LOGOUT" }),
        ],
      }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByText("LOGIN")).toBeInTheDocument();
    expect(screen.getByText("LOGOUT")).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 2")).toBeInTheDocument();
  });

  it("renders the generic empty state for admin or pharmacist users", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({ count: 0, results: [] }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth("PHARMACIST") });

    expect(await screen.findByText("No audit events.")).toBeInTheDocument();
  });

  it("renders the superintendent phase-limited empty state", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({ count: 0, results: [] }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth("SUPERINTENDENT") });

    expect(
      await screen.findByText(
        "Group-level audit visibility is limited in this phase.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the loading state", () => {
    listAuditEventsMock.mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("renders the error state with Retry", async () => {
    listAuditEventsMock
      .mockRejectedValueOnce(new Error("Nope"))
      .mockResolvedValueOnce(makePaginatedAuditEvents());
    const user = userEvent.setup();

    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(
      await screen.findByText("Could not load audit events."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(listAuditEventsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("calls listAuditEvents with the selected action", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    await screen.findByText("USER_CREATED");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Action" }),
      "LOGIN_FAILED",
    );

    await waitFor(() => {
      expect(listAuditEventsMock).toHaveBeenCalledWith({
        page: 1,
        action: "LOGIN_FAILED",
      });
    });
  });

  it("resets to page 1 when the action filter changes", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({
        count: 50,
        next: "http://backend.example.test/api/audit/?page=2",
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    await screen.findByText("USER_CREATED");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(listAuditEventsMock).toHaveBeenCalledWith({
        page: 2,
        action: "",
      });
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Action" }),
      "USER_CREATED",
    );

    await waitFor(() => {
      expect(listAuditEventsMock).toHaveBeenCalledWith({
        page: 1,
        action: "USER_CREATED",
      });
    });
  });

  it("disables Next when next is null", async () => {
    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByText("USER_CREATED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("enables Next when next is non-null", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({
        next: "http://backend.example.test/api/audit/?page=2",
      }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByText("USER_CREATED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("clicking Next requests page 2", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({
        next: "http://backend.example.test/api/audit/?page=2",
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    await screen.findByText("USER_CREATED");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(listAuditEventsMock).toHaveBeenCalledWith({
        page: 2,
        action: "",
      });
    });
  });

  it("disables Prev on page 1", async () => {
    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByText("USER_CREATED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
  });
});
