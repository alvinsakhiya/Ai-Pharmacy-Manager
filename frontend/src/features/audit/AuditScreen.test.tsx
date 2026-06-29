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

  it("renders the polished header, summary cards, and timeline events", async () => {
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
            created_at: new Date().toISOString(),
          }),
        ],
      }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(
      screen.getByRole("heading", { name: "Audit Log" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Review operational activity across pharmacy workflows. Human review required.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Today").length).toBeGreaterThan(0);
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("High importance")).toBeInTheDocument();
    expect(screen.getByText("User actions")).toBeInTheDocument();
    expect(screen.getByText("System actions")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Audit trail" }))
      .toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Today" }))
      .toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Password reset" }))
      .toBeInTheDocument();
    expect(screen.getByText("PASSWORD_RESET")).toBeInTheDocument();
    expect(screen.getByText("pharmacist@example.com")).toBeInTheDocument();
    expect(screen.getByText("PHARMACIST")).toBeInTheDocument();
    expect(screen.getByText("User #88")).toBeInTheDocument();
    expect(screen.getByText("Metadata retained for audit record."))
      .toBeInTheDocument();
    expect(screen.queryByText('{"reason":"temporary reset"}')).toBeNull();
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

    expect(await screen.findByRole("heading", { name: "Login" }))
      .toBeInTheDocument();
    expect(screen.getByText("LOGOUT")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Earlier" }))
      .toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 2")).toBeInTheDocument();
  });

  it("renders the generic empty state for admin or pharmacist users", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({ count: 0, results: [] }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth("PHARMACIST") });

    expect(
      await screen.findByText("No audit events match the current filter."),
    ).toBeInTheDocument();
  });

  it("renders the superintendent phase-limited empty state", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({ count: 0, results: [] }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth("SUPERINTENDENT") });

    expect(
      await screen.findByText("No audit events match the current filter."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Group-level audit visibility is limited in this phase."),
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

    await screen.findByRole("heading", { name: "User created" });
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

    await screen.findByRole("heading", { name: "User created" });
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

    expect(await screen.findByRole("heading", { name: "User created" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("enables Next when next is non-null", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({
        next: "http://backend.example.test/api/audit/?page=2",
      }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByRole("heading", { name: "User created" }))
      .toBeInTheDocument();
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

    await screen.findByRole("heading", { name: "User created" });
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

    expect(await screen.findByRole("heading", { name: "User created" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
  });

  it("does not expose raw metadata or patient PII from metadata", async () => {
    listAuditEventsMock.mockResolvedValue(
      makePaginatedAuditEvents({
        results: [
          makeAuditEvent({
            metadata: {
              patient_name: "Jane Patient",
              date_of_birth: "1980-01-01",
              postcode: "AB1 2CD",
              phone: "07123456789",
              email: "patient@example.test",
              address: "1 Private Street",
              nhs_number: "999 000 0000",
            },
          }),
        ],
      }),
    );

    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByRole("heading", { name: "User created" }))
      .toBeInTheDocument();
    expect(screen.getByText("Metadata retained for audit record."))
      .toBeInTheDocument();
    for (const forbidden of [
      "Jane Patient",
      "1980-01-01",
      "AB1 2CD",
      "07123456789",
      "patient@example.test",
      "1 Private Street",
      "999 000 0000",
      "patient_name",
      "nhs_number",
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("does not render audit mutation controls", async () => {
    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByRole("heading", { name: "User created" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  });

  it("keeps audit wording operational and non-clinical", async () => {
    renderWithProviders(<AuditScreen />, { auth: auditAuth() });

    expect(await screen.findByRole("heading", { name: "User created" }))
      .toBeInTheDocument();
    const bodyText = document.body.textContent ?? "";
    for (const forbidden of [
      "clinically recommended",
      "diagnosis",
      "NHS integration",
      "AI decided",
      "must order",
      "must transfer",
      "automatic dispensing",
      "automatic ordering",
      "automatic transfer",
      "compliance proof",
      "guaranteed forecast",
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }
  });
});
