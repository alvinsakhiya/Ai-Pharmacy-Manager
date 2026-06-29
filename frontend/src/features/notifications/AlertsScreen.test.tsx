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
    dismissAlert: vi.fn(),
    clearAlerts: vi.fn(),
  };
});

const getAlertsMock = vi.mocked(notificationsApi.getAlerts);
const dismissAlertMock = vi.mocked(notificationsApi.dismissAlert);
const clearAlertsMock = vi.mocked(notificationsApi.clearAlerts);

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

function makeNearExpiryAlert(overrides: Partial<Alert> = {}): Alert {
  return makeStockAlert({
    id: "stock:near_expiry:21",
    type: "near_expiry",
    severity: "warning",
    title: "Near expiry: Amoxicillin",
    message: "Batch expires soon. Review before action.",
    subject: {
      stock_item_id: 21,
      medication_id: 14,
      medication_name: "Amoxicillin",
    },
    ...overrides,
  });
}

function makeLowStockAlert(overrides: Partial<Alert> = {}): Alert {
  return makeStockAlert({
    id: "stock:low_stock:22",
    type: "low_stock",
    severity: "warning",
    title: "Low stock: Cetirizine",
    message: "Stock is below the configured review threshold.",
    subject: {
      stock_item_id: 22,
      medication_id: 15,
      medication_name: "Cetirizine",
    },
    ...overrides,
  });
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
    dismissAlertMock.mockResolvedValue({
      fingerprint: "stock:stockout:7",
      dismissed: true,
      created: true,
      summary: makeAlertsResponse({ alerts: [] }).summary,
    });
    clearAlertsMock.mockResolvedValue({
      dismissed_count: 3,
      created_count: 3,
      summary: makeAlertsResponse({ alerts: [] }).summary,
    });
  });

  it("renders the page header", async () => {
    renderAlerts();

    expect(
      await screen.findByRole("heading", { name: "Alerts", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review operational alerts before taking action."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use Work Queue for tasks that need action, such as Dosette preparation, pending checks, and stock follow-up.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Alerts highlight operational signals. Review before action.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Alert centre")).toBeInTheDocument();
    expect(screen.getByText("Human review required")).toBeInTheDocument();
    expect(screen.getAllByText("All alerts").length).toBeGreaterThan(0);
    expect(await screen.findByText("Alert controls")).toBeInTheDocument();
    expect(screen.getByText("Operational alert grid")).toBeInTheDocument();
    expect(screen.getByText("3 alerts shown")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open Work Queue" })[0])
      .toHaveAttribute("href", "/work-queue");
  });

  it("filters alerts by search, severity, and category without refetching", async () => {
    const user = userEvent.setup();
    renderAlerts();

    expect(await screen.findByText("Stockout: Paracetamol")).toBeInTheDocument();
    expect(screen.getByText("Prepared cycle awaiting stock deduction"))
      .toBeInTheDocument();
    expect(screen.getByText("Dead stock: Ibuprofen")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search alerts"), "Ibuprofen");

    expect(screen.getByText("Dead stock: Ibuprofen")).toBeInTheDocument();
    expect(screen.queryByText("Stockout: Paracetamol")).toBeNull();
    expect(
      screen.queryByText("Prepared cycle awaiting stock deduction"),
    ).toBeNull();
    expect(screen.getAllByText("1 active filter").length).toBeGreaterThan(0);
    expect(screen.getByText("1 alerts shown")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search alerts"));
    await user.selectOptions(screen.getByLabelText("Severity"), "warning");

    expect(screen.getByText("Prepared cycle awaiting stock deduction"))
      .toBeInTheDocument();
    expect(screen.queryByText("Stockout: Paracetamol")).toBeNull();
    expect(screen.queryByText("Dead stock: Ibuprofen")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Category"), "stock");

    expect(
      screen.getByText("No alerts match the current view."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("2 active filters").length).toBeGreaterThan(0);
    expect(getAlertsMock).toHaveBeenCalledTimes(1);
  });

  it("renders summary counters", async () => {
    renderAlerts();

    const summary = await screen.findByRole("region", {
      name: "Alerts summary",
    });
    expect(within(summary).getByText("Critical")).toBeInTheDocument();
    expect(within(summary).getByText("Due soon")).toBeInTheDocument();
    expect(within(summary).getByText("Stock")).toBeInTheDocument();
    expect(within(summary).getByText("Expiry")).toBeInTheDocument();
    expect(within(summary).getByText("Active alerts")).toBeInTheDocument();
    expect(screen.getAllByText("Active alerts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders severity and category chips", async () => {
    renderAlerts();

    expect((await screen.findAllByText("Critical")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Warning").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Info").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dosette").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stockout").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prepared Not Deducted").length).toBeGreaterThan(
      0,
    );
  });

  it("renders alerts in grouped operational grids", async () => {
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
    expect(screen.getByRole("heading", { name: "Critical" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "MDS workflow" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stock review" }))
      .toBeInTheDocument();
    expect(screen.getAllByText("Next step").length).toBeGreaterThan(0);
    const bodyText = document.body.textContent ?? "";
    expect(bodyText.indexOf("Stockout: Paracetamol")).toBeLessThan(
      bodyText.indexOf("Dead stock: Ibuprofen"),
    );
    expect(bodyText.indexOf("Dead stock: Ibuprofen")).toBeLessThan(
      bodyText.indexOf("Prepared cycle awaiting stock deduction"),
    );
  });

  it("shows warning near-expiry alerts exactly once in Expiry review", async () => {
    getAlertsMock.mockResolvedValueOnce(
      makeAlertsResponse({
        alerts: [makeNearExpiryAlert()],
      }),
    );

    renderAlerts();

    expect(await screen.findByText("Near expiry: Amoxicillin")).toBeInTheDocument();
    expect(screen.getAllByText("Near expiry: Amoxicillin")).toHaveLength(1);
    const expiryGroup = screen.getByRole("region", { name: "Expiry review" });
    expect(within(expiryGroup).getByText("Near expiry: Amoxicillin"))
      .toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Due soon" })).toBeNull();
  });

  it("shows warning low-stock alerts exactly once in Stock review", async () => {
    getAlertsMock.mockResolvedValueOnce(
      makeAlertsResponse({
        alerts: [makeLowStockAlert()],
      }),
    );

    renderAlerts();

    expect(await screen.findByText("Low stock: Cetirizine")).toBeInTheDocument();
    expect(screen.getAllByText("Low stock: Cetirizine")).toHaveLength(1);
    const stockGroup = screen.getByRole("region", { name: "Stock review" });
    expect(within(stockGroup).getByText("Low stock: Cetirizine"))
      .toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Due soon" })).toBeNull();
  });

  it("keeps unmatched alerts visible once in the fallback group", async () => {
    getAlertsMock.mockResolvedValueOnce(
      makeAlertsResponse({
        alerts: [
          makeStockAlert({
            id: "other:operational:23",
            category: "other" as Alert["category"],
            type: "unmapped_signal",
            severity: "info",
            title: "Unmapped operational signal",
            message: "Review before action.",
            subject: {},
          }),
        ],
      }),
    );

    renderAlerts();

    expect(
      await screen.findByText("Unmapped operational signal"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Unmapped operational signal")).toHaveLength(1);
    const fallbackGroup = screen.getByRole("region", { name: "Action needed" });
    expect(within(fallbackGroup).getByText("Unmapped operational signal"))
      .toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /Open Inventory/ }))
      .toHaveAttribute("href", "/inventory/7");
    expect(screen.queryByText("PRIVATE-PATIENT")).toBeNull();
  });

  it("renders Dosette alerts with pseudonymous subject details only", async () => {
    renderAlerts();

    expect(
      await screen.findByText("Prepared cycle awaiting stock deduction"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cycle MDS-2026-FW07 · Patient ID CRO-P1"))
      .toBeInTheDocument();
    expect(
      screen.getAllByText("Operational tasks are managed in Work Queue.").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Open Work Queue/ })[0])
      .toHaveAttribute("href", "/work-queue");
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

    expect(
      screen.getAllByText("Loading alerts...").length,
    ).toBeGreaterThan(0);
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

    expect(
      await screen.findByText("No alerts match the current view."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Adjust the filters or refresh the alert centre."),
    ).toBeInTheDocument();
  });

  it("dismisses one alert", async () => {
    const user = userEvent.setup();
    renderAlerts();

    expect(await screen.findByText("Stockout: Paracetamol")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Dismiss alert" })[0]);

    await waitFor(() => {
      expect(dismissAlertMock).toHaveBeenCalledWith(
        "stock:stockout:7",
        expect.anything(),
      );
    });
    expect(screen.queryByText("Stockout: Paracetamol")).toBeNull();
  });

  it("dismisses visible alerts with existing clear semantics", async () => {
    const user = userEvent.setup();
    renderAlerts();

    expect(await screen.findByText("Stockout: Paracetamol")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss visible alerts" }));

    await waitFor(() => {
      expect(clearAlertsMock).toHaveBeenCalledWith(
        [
          "stock:stockout:7",
          "dosette:prepared_not_deducted:12",
          "stock:dead_stock:8",
        ],
        expect.anything(),
      );
    });
    expect(
      await screen.findByText("No alerts match the current view."),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", {
        name: /resolve|complete|order|transfer|create cycle/i,
      }),
    ).toBeNull();
    expect(screen.getAllByRole("button", { name: "Dismiss alert" }).length)
      .toBeGreaterThan(0);
  });
});
