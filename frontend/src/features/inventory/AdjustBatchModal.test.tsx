import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import { AdjustBatchModal } from "./AdjustBatchModal";
import type { AdjustBatchResponse, StockBatch, StockItemDetail } from "./inventoryApi";
import * as inventoryApi from "./inventoryApi";

vi.mock("./inventoryApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./inventoryApi")>();
  return {
    ...actual,
    adjustBatch: vi.fn(),
  };
});

const adjustBatchMock = vi.mocked(inventoryApi.adjustBatch);

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

function adjustResponse(): AdjustBatchResponse {
  return {
    stock_item: makeStockItemDetail(),
    movement: {
      id: 1,
      movement_type: "ADJUSTMENT",
      quantity_delta: -2,
      balance_after: 16,
      batch: 30,
    },
  };
}

describe("AdjustBatchModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adjustBatchMock.mockResolvedValue(adjustResponse());
  });

  it("submitting valid form calls adjustBatch with signed delta and reason", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdjustBatchModal batch={makeBatch()} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Delta"), "-2");
    await user.type(screen.getByLabelText("Reason"), "Damaged stock");
    await user.click(screen.getByRole("button", { name: "Adjust batch" }));

    await waitFor(() => {
      expect(adjustBatchMock).toHaveBeenCalledWith(30, {
        delta: -2,
        reason: "Damaged stock",
        reference: undefined,
      });
    });
  });

  it("blocks zero delta", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdjustBatchModal batch={makeBatch()} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Delta"), "0");
    await user.type(screen.getByLabelText("Reason"), "Damaged stock");
    await user.click(screen.getByRole("button", { name: "Adjust batch" }));

    expect(screen.getByText("Delta cannot be zero.")).toBeInTheDocument();
    expect(adjustBatchMock).not.toHaveBeenCalled();
  });

  it("blocks missing reason", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AdjustBatchModal batch={makeBatch()} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Delta"), "-2");
    await user.click(screen.getByRole("button", { name: "Adjust batch" }));

    expect(screen.getByText("Reason is required.")).toBeInTheDocument();
    expect(adjustBatchMock).not.toHaveBeenCalled();
  });

  it("renders backend delta errors", async () => {
    adjustBatchMock.mockRejectedValue(
      new ApiError(400, {
        delta: ["Adjustment would result in negative stock."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <AdjustBatchModal batch={makeBatch()} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Delta"), "-99");
    await user.type(screen.getByLabelText("Reason"), "Damaged stock");
    await user.click(screen.getByRole("button", { name: "Adjust batch" }));

    expect(
      await screen.findByText("Adjustment would result in negative stock."),
    ).toBeInTheDocument();
  });

  it("renders backend batch errors", async () => {
    adjustBatchMock.mockRejectedValue(
      new ApiError(400, {
        batch: ["Cannot modify an inactive batch."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <AdjustBatchModal batch={makeBatch()} isOpen onClose={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("Delta"), "-2");
    await user.type(screen.getByLabelText("Reason"), "Damaged stock");
    await user.click(screen.getByRole("button", { name: "Adjust batch" }));

    expect(
      await screen.findByText("Cannot modify an inactive batch."),
    ).toBeInTheDocument();
  });
});
