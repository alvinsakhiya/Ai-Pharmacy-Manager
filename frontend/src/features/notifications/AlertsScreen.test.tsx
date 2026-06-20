import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NAV_ITEMS } from "../../app/navConfig";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { AlertsScreen } from "./AlertsScreen";
import type { Alert, AlertsResponse } from "./notificationsApi";
import * as notificationsApi from "./notificationsApi";

vi.mock("./notificationsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./notificationsApi")>();
  return {
    ...actual,
    getAlerts: vi.fn(),
  };
});

const getAlertsMock = vi.mocked(notificationsApi.getAlerts);

function makeStockAlert(overrides: Partial<Alert> = {}): Alert {
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

function makeDosetteAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "dosette:prepared_not_deducted:12",
    category: "dosette",
    type: "prepared_not_deducted",
    severity: "warning",
    title: "Prepared cycle awaiting stock deduction",
    message: "Cycle MDS-2026-FW07 is prepared but stock has not been deducted.",
    pharmacy_id: 2,
    subject: {
      dosette_cycle_id: 12,
      cycle_reference: "MDS-2026-FW07",
      patient_id: 4,
      patient_reference: "CRO-P1",
    },
    ...overrides,
  };
}

function makeAlertsResponse(
  overrides: Partial<AlertsResponse> = {},
): AlertsResponse {
  return {
    generated_at: "2026-06-20T10:00:00Z",
    summary: {
      total: 3,
      critical: 1,
      warning: 1,
      info: 1,
      by_category: {
        stock: 2,
        dosette: 1,
      },
    },
    alerts: [
      makeStockAlert(),
      makeDosetteAlert(),
      makeStockAlert({
        id: "stock:dead_stock:8",
        type: "dead_stock",
        severity: "info",
        title: "Dead stock: Ibuprofen",
        message: "Dead stock: no outbound movement in 90 days",
        pharmacy_id: 2,
        subject: {
          stock_item_id: 8,
          medication_id: 5,
          medication_name: "Ibuprofen",
        },
      }),
    ],
    ...overrides,
  };
}

function alertsAuth() {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
        "blister.view": true,
      },
    }),
  });
}

function renderAlerts() {
  return renderWithProviders(<AlertsScreen />, {
    auth: alertsAuth(),
  });
}

describe("AlertsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAlertsMock.mockResolvedValue(makeAlertsResponse());
  });

  it("renders the page header", async () => {
    renderAlerts();

    expect(
      await screen.findByRole("heading", { name: "Alerts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Operational stock and Dosette/MDS alerts."),
    ).toBeInTheDocument();
  });

  it("renders summary counters", async () => {
    renderAlerts();

    expect(await screen.findByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getAllByText("Stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dosette").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders severity and category chips", async () => {
    renderAlerts();

    expect(await screen.findByText("critical")).toBeInTheDocument();
    expect(screen.getByText("warning")).toBeInTheDocument();
    expect(screen.getByText("info")).toBeInTheDocument();
    expect(screen.getAllByText("Stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dosette").length).toBeGreaterThan(0);
  });

  it("renders alerts in backend order", async () => {
    getAlertsMock.mockResolvedValueOnce(
      makeAlertsResponse({
        alerts: [
          makeStockAlert({
            id: "stock:dead_stock:8",
            severity: "info",
            title: "Dead stock: Ibuprofen",
          }),
          makeStockAlert(),
          makeDosetteAlert(),
        ],
      }),
    );

    renderAlerts();

    expect(await screen.findByText("Dead stock: Ibuprofen")).toBeInTheDocument();
    const bodyText = document.body.textContent ?? "";
    expect(bodyText.indexOf("Dead stock: Ibuprofen")).toBeLessThan(
      bodyText.indexOf("Stockout: Paracetamol"),
    );
    expect(bodyText.indexOf("Stockout: Paracetamol")).toBeLessThan(
      bodyText.indexOf("Prepared cycle awaiting stock deduction"),
    );
  });

  it("renders stock alerts with only safe stock subject details", async () => {
    getAlertsMock.mockResolvedValueOnce(
      makeAlertsResponse({
        summary: {
          total: 1,
          critical: 1,
          warning: 0,
          info: 0,
          by_category: { stock: 1, dosette: 0 },
        },
        alerts: [
          makeStockAlert({
            subject: {
              stock_item_id: 7,
              medication_id: 3,
              medication_name: "Paracetamol",
              patient_reference: "PRIVATE-PATIENT",
            },
          }),
        ],
      }),
    );

    renderAlerts();

    expect(await screen.findByText("Stockout: Paracetamol")).toBeInTheDocument();
    expect(screen.getByText("0 units on hand.")).toBeInTheDocument();
    expect(screen.getByText("Paracetamol · Pharmacy 1")).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE-PATIENT")).toBeNull();
  });

  it("renders Dosette alerts with pseudonymous subject details only", async () => {
    renderAlerts();

    expect(
      await screen.findByText("Prepared cycle awaiting stock deduction"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cycle MDS-2026-FW07 · Patient CRO-P1"))
      .toBeInTheDocument();
    for (const forbidden of [
      "Patient One",
      "date_of_birth",
      "address",
      "phone",
      "dose",
      "notes",
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("renders loading error and empty states", async () => {
    getAlertsMock.mockReturnValueOnce(new Promise<AlertsResponse>(() => undefined));
    const loadingRender = renderAlerts();

    expect(screen.getByText("Loading alerts...")).toBeInTheDocument();
    loadingRender.unmount();
    getAlertsMock.mockClear();

    getAlertsMock.mockRejectedValueOnce(new Error("No alerts"));
    const user = userEvent.setup();
    const errorRender = renderAlerts();

    expect(await screen.findByText("Could not load alerts.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(getAlertsMock).toHaveBeenCalledTimes(2);
    });
    errorRender.unmount();

    getAlertsMock.mockResolvedValueOnce(
      makeAlertsResponse({
        summary: {
          total: 0,
          critical: 0,
          warning: 0,
          info: 0,
          by_category: { stock: 0, dosette: 0 },
        },
        alerts: [],
      }),
    );
    renderAlerts();

    expect(await screen.findByText("No active alerts.")).toBeInTheDocument();
  });

  it("adds alerts to navigation for stock or blister view users", () => {
    expect(NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Alerts",
          path: "/alerts",
          requiredAnyOf: ["stock.view", "blister.view"],
        }),
      ]),
    );
  });

  it("does not render patient data fields or mutation controls", async () => {
    renderAlerts();

    expect(await screen.findByText("Stockout: Paracetamol")).toBeInTheDocument();
    const documentBody = within(document.body);
    for (const forbidden of [
      "patient_reference",
      "first_name",
      "last_name",
      "date_of_birth",
      "address",
      "phone",
      "dose_instructions",
      "note",
      "01/01/1980",
      "Patient One",
      "Private Address",
    ]) {
      expect(documentBody.queryByText(forbidden)).toBeNull();
    }
    expect(screen.queryByRole("button", { name: /mark|resolve|dismiss|read/i }))
      .toBeNull();
  });
});
