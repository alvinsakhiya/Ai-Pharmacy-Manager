import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { NotificationCentre } from "./NotificationCentre";
import type { Alert, AlertsResponse } from "./notificationsApi";
import * as notificationsApi from "./notificationsApi";

vi.mock("./notificationsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./notificationsApi")>();
  return {
    ...actual,
    getAlerts: vi.fn(),
    dismissAlert: vi.fn(),
    clearAlerts: vi.fn(),
  };
});

const getAlertsMock = vi.mocked(notificationsApi.getAlerts);
const dismissAlertMock = vi.mocked(notificationsApi.dismissAlert);
const clearAlertsMock = vi.mocked(notificationsApi.clearAlerts);

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "stock:stockout:7",
    category: "stock",
    type: "stockout",
    severity: "critical",
    title: "Stockout: Paracetamol",
    message: "0 units on hand.",
    pharmacy_id: 1,
    subject: {
      stock_item_id: 7,
      medication_id: 3,
      medication_name: "Paracetamol",
    },
    ...overrides,
  };
}

function makeAlertsResponse(overrides: Partial<AlertsResponse> = {}): AlertsResponse {
  const alerts = overrides.alerts ?? [
    makeAlert(),
    makeAlert({
      id: "stock:low_stock:8",
      type: "low_stock",
      severity: "warning",
      title: "Low stock: Ibuprofen",
      message: "Low stock: 3 on hand at or below reorder level 20",
      pharmacy_id: 2,
    }),
  ];
  return {
    generated_at: "2026-06-22T10:00:00Z",
    summary: {
      total: alerts.length,
      critical: alerts.filter((alert) => alert.severity === "critical").length,
      warning: alerts.filter((alert) => alert.severity === "warning").length,
      info: alerts.filter((alert) => alert.severity === "info").length,
      by_category: {
        stock: alerts.filter((alert) => alert.category === "stock").length,
        dosette: alerts.filter((alert) => alert.category === "dosette").length,
      },
    },
    alerts,
    ...overrides,
  };
}

function renderNotificationCentre() {
  return renderWithProviders(<NotificationCentre />, {
    auth: makeAuthContext({
      user: makeAuthUser({
        permissions: {
          "stock.view": true,
          "blister.view": true,
        },
      }),
    }),
  });
}

describe("NotificationCentre", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAlertsMock.mockResolvedValue(makeAlertsResponse());
    dismissAlertMock.mockResolvedValue({
      fingerprint: "stock:stockout:7",
      dismissed: true,
      created: true,
      summary: makeAlertsResponse({ alerts: [] }).summary,
    });
    clearAlertsMock.mockResolvedValue({
      dismissed_count: 2,
      created_count: 2,
      summary: makeAlertsResponse({ alerts: [] }).summary,
    });
  });

  it("shows the alert count badge and opens the notification panel", async () => {
    const user = userEvent.setup();
    renderNotificationCentre();

    const button = await screen.findByRole("button", {
      name: "Open notification centre",
    });
    expect(await screen.findByText("2")).toBeInTheDocument();

    await user.click(button);

    expect(screen.getByRole("heading", { name: "Notification centre" }))
      .toBeInTheDocument();
    expect(
      screen.getByText(
        "Review operational alerts before action. Work Queue keeps tasks separate.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("2 active alerts")).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();
    expect(screen.getByText("Stockout: Paracetamol")).toBeInTheDocument();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getByText("Stockout")).toBeInTheDocument();
    expect(screen.getByText("Low stock: Ibuprofen")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Alerts" }))
      .toHaveAttribute("href", "/alerts");
    expect(screen.getByRole("link", { name: "Open Work Queue" }))
      .toHaveAttribute("href", "/work-queue");
  });

  it("dismisses an alert and removes it from the panel after success", async () => {
    const user = userEvent.setup();
    renderNotificationCentre();

    await user.click(
      await screen.findByRole("button", { name: "Open notification centre" }),
    );
    await user.click(screen.getAllByRole("button", { name: "Dismiss alert" })[0]);

    await waitFor(() => {
      expect(dismissAlertMock).toHaveBeenCalledWith(
        "stock:stockout:7",
        expect.anything(),
      );
    });
    expect(screen.queryByText("Stockout: Paracetamol")).toBeNull();
    expect(screen.getByText("Low stock: Ibuprofen")).toBeInTheDocument();
  });

  it("clears all visible alerts", async () => {
    const user = userEvent.setup();
    renderNotificationCentre();

    await user.click(
      await screen.findByRole("button", { name: "Open notification centre" }),
    );
    await user.click(screen.getByRole("button", { name: "Dismiss visible" }));

    await waitFor(() => {
      expect(clearAlertsMock).toHaveBeenCalledWith(
        ["stock:stockout:7", "stock:low_stock:8"],
        expect.anything(),
      );
    });
    expect(screen.getByText("No active alerts")).toBeInTheDocument();
  });

  it("renders loading error and empty states", async () => {
    getAlertsMock.mockReturnValueOnce(new Promise<AlertsResponse>(() => undefined));
    const user = userEvent.setup();
    const loadingRender = renderNotificationCentre();

    await user.click(
      await screen.findByRole("button", { name: "Open notification centre" }),
    );
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    loadingRender.unmount();

    getAlertsMock.mockRejectedValueOnce(new Error("No alerts"));
    const errorRender = renderNotificationCentre();
    await user.click(
      await screen.findByRole("button", { name: "Open notification centre" }),
    );
    expect(await screen.findByText("Could not load alerts."))
      .toBeInTheDocument();
    errorRender.unmount();

    getAlertsMock.mockResolvedValueOnce(makeAlertsResponse({ alerts: [] }));
    renderNotificationCentre();
    await user.click(
      await screen.findByRole("button", { name: "Open notification centre" }),
    );
    expect(await screen.findByText("No active alerts")).toBeInTheDocument();
    expect(
      screen.getByText("Work Queue will show tasks that need action."),
    ).toBeInTheDocument();
  });

  it("does not render patient identifiers in the compact centre", async () => {
    const user = userEvent.setup();
    getAlertsMock.mockResolvedValueOnce(
      makeAlertsResponse({
        alerts: [
          makeAlert({
            id: "dosette:prepared_not_deducted:12",
            category: "dosette",
            type: "prepared_not_deducted",
            severity: "warning",
            title: "Prepared cycle awaiting stock deduction",
            message: "Cycle MDS-2026-FW07 is prepared but stock has not been deducted.",
            subject: {
              dosette_cycle_id: 12,
              cycle_reference: "MDS-2026-FW07",
              patient_id: 4,
              patient_reference: "PRIVATE-PATIENT",
            },
          }),
        ],
      }),
    );
    renderNotificationCentre();

    await user.click(
      await screen.findByRole("button", { name: "Open notification centre" }),
    );

    expect(
      await screen.findByText("Prepared cycle awaiting stock deduction"),
    ).toBeInTheDocument();
    expect(screen.getByText("Managed in Work Queue.")).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE-PATIENT")).toBeNull();
    expect(screen.queryByText("patient_reference")).toBeNull();
  });
});
