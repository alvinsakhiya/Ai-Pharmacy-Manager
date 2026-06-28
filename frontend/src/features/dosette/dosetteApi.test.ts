import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestJson } from "../../lib/apiClient";
import {
  listDosettePeriods,
  markDosettePeriodCollected,
  submitDosettePeriod,
  type DosettePeriod,
} from "./dosetteApi";

vi.mock("../../lib/apiClient", () => ({
  requestJson: vi.fn(),
}));

const requestJsonMock = vi.mocked(requestJson);

function makePeriod(overrides: Partial<DosettePeriod> = {}): DosettePeriod {
  return {
    id: 70,
    patient_reference: "SUT-P1",
    start_date: "2026-06-29",
    end_date: "2026-07-26",
    status: "SUBMITTED",
    submitted_at: "2026-06-28T10:00:00Z",
    collected_on: null,
    next_due_date: null,
    reminder_date: null,
    cycles: [
      {
        id: 701,
        reference: "MDS-PERIOD-70-W1",
        week_number: 1,
        start_date: "2026-06-29",
        end_date: "2026-07-05",
        status: "DRAFT",
        stock_deducted: false,
      },
    ],
    created_at: "2026-06-28T10:00:00Z",
    updated_at: "2026-06-28T10:00:00Z",
    ...overrides,
  };
}

describe("dosette period api", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lists dosette periods and handles the period response shape", async () => {
    requestJsonMock.mockResolvedValueOnce([makePeriod()]);

    const periods = await listDosettePeriods(20);

    expect(requestJsonMock).toHaveBeenCalledWith(
      "/api/patients/20/dosette-periods/",
    );
    expect(periods[0].cycles[0].week_number).toBe(1);
    expect(periods[0].next_due_date).toBeNull();
  });

  it("submits a dosette period to the correct endpoint", async () => {
    requestJsonMock.mockResolvedValueOnce(makePeriod());

    await submitDosettePeriod(20, { start_date: "2026-06-29" });

    expect(requestJsonMock).toHaveBeenCalledWith(
      "/api/patients/20/dosette-periods/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: "2026-06-29" }),
      },
    );
  });

  it("marks a dosette period collected through the correct endpoint", async () => {
    requestJsonMock.mockResolvedValueOnce(
      makePeriod({
        status: "COLLECTED",
        collected_on: "2026-07-27",
        next_due_date: "2026-08-24",
        reminder_date: "2026-08-17",
      }),
    );

    await markDosettePeriodCollected(20, 70, { collected_on: "2026-07-27" });

    expect(requestJsonMock).toHaveBeenCalledWith(
      "/api/patients/20/dosette-periods/70/collected/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collected_on: "2026-07-27" }),
      },
    );
  });
});
