import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import { CountBatchModal } from "./CountBatchModal";
import type { CountBatchResponse, StockBatch, StockItemDetail } from "./inventoryApi";
import * as inventoryApi from "./inventoryApi";

vi.mock("./inventoryApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./inventoryApi")>();
  return {
    ...actual,
    countBatch: vi.fn(),
  };
});

const countBatchMock = vi.mocked(inventoryApi.countBatch);

function makeBatch(): StockBatch {
  return {
    id: 30,
    batch_number: "LOT-100",
    expiry_date: "2027-01-31",
    quantity: 18,
    quantity_received: 20,
    received_at: "2026-01-01",
    is_active: true,
  };
}

function makeStockItemDetail(): StockItemDetail {
  return {
    id: 20,
    pharmacy: 1,
    medication: 10,
    medication_name: "Paracetamol",
    unit_price: "0.03",
    reorder_level: 5,
    is_active: true,
    quantity_on_hand: 18,
    earliest_expiry: "2027-01-31",
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    batches: [makeBatch()],
  };
}

function countResponse(changed = true): CountBatchResponse {
  return {
    stock_item: makeStockItemDetail(),
    changed,
    movement: changed
      ? {
          id: 1,
          movement_type: "COUNT_CORRECTION",
          quantity_delta: 2,
          balance_after: 20,
          batch: 30,
        }
      : null,
  };
}

describe("CountBatchModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    countBatchMock.mockResolvedValue(countResponse());
  });

  it("submitting valid form calls countBatch with counted quantity", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CountBatchModal batch={makeBatch()} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Counted quantity"), "20");
    await user.click(screen.getByRole("button", { name: "Record count" }));

    await waitFor(() => {
      expect(countBatchMock).toHaveBeenCalledWith(30, {
        counted_quantity: 20,
        reason: undefined,
        reference: undefined,
      });
    });
  });

  it("blocks negative counted quantity", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CountBatchModal batch={makeBatch()} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Counted quantity"), "-1");
    await user.click(screen.getByRole("button", { name: "Record count" }));

    expect(
      screen.getByText("Counted quantity must be a number of at least 0."),
    ).toBeInTheDocument();
    expect(countBatchMock).not.toHaveBeenCalled();
  });

  it("shows no-change note and keeps modal open when count is unchanged", async () => {
    countBatchMock.mockResolvedValue(countResponse(false));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CountBatchModal batch={makeBatch()} isOpen onClose={onClose} />,
    );

    await user.type(screen.getByLabelText("Counted quantity"), "18");
    await user.click(screen.getByRole("button", { name: "Record count" }));

    expect(
      await screen.findByText(
        "No change recorded — counted quantity matched current stock.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes modal when count changes", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CountBatchModal batch={makeBatch()} isOpen onClose={onClose} />,
    );

    await user.type(screen.getByLabelText("Counted quantity"), "20");
    await user.click(screen.getByRole("button", { name: "Record count" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("renders backend batch errors", async () => {
    countBatchMock.mockRejectedValue(
      new ApiError(400, {
        batch: ["Cannot modify an inactive batch."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <CountBatchModal batch={makeBatch()} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Counted quantity"), "20");
    await user.click(screen.getByRole("button", { name: "Record count" }));

    expect(
      await screen.findByText("Cannot modify an inactive batch."),
    ).toBeInTheDocument();
  });
});
