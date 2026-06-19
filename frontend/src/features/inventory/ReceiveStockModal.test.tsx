import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import { ReceiveStockModal } from "./ReceiveStockModal";
import type { ReceiveStockResponse, StockItemDetail } from "./inventoryApi";
import * as inventoryApi from "./inventoryApi";

vi.mock("./inventoryApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./inventoryApi")>();
  return {
    ...actual,
    receiveStock: vi.fn(),
  };
});

const receiveStockMock = vi.mocked(inventoryApi.receiveStock);

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
    batches: [],
  };
}

function receiveResponse(): ReceiveStockResponse {
  return {
    stock_item: makeStockItemDetail(),
    movement: {
      id: 1,
      movement_type: "RECEIPT",
      quantity_delta: 12,
      balance_after: 30,
      batch: 2,
    },
  };
}

describe("ReceiveStockModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    receiveStockMock.mockResolvedValue(receiveResponse());
  });

  it("submitting valid form calls receiveStock with numeric quantity", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiveStockModal
        isOpen
        onClose={vi.fn()}
        stockItem={makeStockItemDetail()}
      />,
    );

    await user.type(screen.getByLabelText("Batch number"), "LOT-100");
    await user.type(screen.getByLabelText("Expiry date"), "2027-01-31");
    await user.type(screen.getByLabelText("Quantity"), "12");
    await user.click(screen.getByRole("button", { name: "Receive stock" }));

    await waitFor(() => {
      expect(receiveStockMock).toHaveBeenCalledWith({
        pharmacy: 1,
        medication: 10,
        batch_number: "LOT-100",
        expiry_date: "2027-01-31",
        quantity: 12,
        received_at: undefined,
        unit_price: undefined,
        reason: undefined,
        reference: undefined,
      });
    });
  });

  it("required validation blocks missing batch number expiry and invalid quantity", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiveStockModal
        isOpen
        onClose={vi.fn()}
        stockItem={makeStockItemDetail()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Receive stock" }));

    expect(screen.getByText("Batch number is required.")).toBeInTheDocument();
    expect(screen.getByText("Expiry date is required.")).toBeInTheDocument();
    expect(
      screen.getByText("Quantity must be a number of at least 1."),
    ).toBeInTheDocument();
    expect(receiveStockMock).not.toHaveBeenCalled();
  });

  it("renders backend field errors", async () => {
    receiveStockMock.mockRejectedValue(
      new ApiError(400, {
        expiry_date: ["Expiry date cannot be before the received date."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <ReceiveStockModal
        isOpen
        onClose={vi.fn()}
        stockItem={makeStockItemDetail()}
      />,
    );

    await user.type(screen.getByLabelText("Batch number"), "LOT-100");
    await user.type(screen.getByLabelText("Expiry date"), "2026-01-01");
    await user.type(screen.getByLabelText("Quantity"), "12");
    await user.click(screen.getByRole("button", { name: "Receive stock" }));

    expect(
      await screen.findByText("Expiry date cannot be before the received date."),
    ).toBeInTheDocument();
  });
});
