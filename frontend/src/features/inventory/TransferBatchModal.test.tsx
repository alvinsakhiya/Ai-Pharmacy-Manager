import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import {
  makeAuthContext,
  makeAuthUser,
  renderWithProviders,
} from "../../test/providers";
import { TransferBatchModal } from "./TransferBatchModal";
import type {
  StockBatch,
  StockItemDetail,
  TransferBatchResponse,
} from "./inventoryApi";
import * as inventoryApi from "./inventoryApi";

vi.mock("./inventoryApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./inventoryApi")>();
  return {
    ...actual,
    transferBatch: vi.fn(),
  };
});

const transferBatchMock = vi.mocked(inventoryApi.transferBatch);

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

function makeStockItemDetail(pharmacy = 1): StockItemDetail {
  return {
    id: 20 + pharmacy,
    pharmacy,
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

function transferResponse(): TransferBatchResponse {
  return {
    source_stock_item: makeStockItemDetail(1),
    destination_stock_item: makeStockItemDetail(2),
    transfer: {
      quantity: 4,
      out_movement: {
        id: 1,
        movement_type: "TRANSFER_OUT",
        quantity_delta: -4,
        balance_after: 14,
        batch: 30,
      },
      in_movement: {
        id: 2,
        movement_type: "TRANSFER_IN",
        quantity_delta: 4,
        balance_after: 4,
        batch: 31,
      },
    },
  };
}

function transferAuth(pharmacies = [{ id: 1, name: "JMW Sutton" }, { id: 2, name: "JMW Croydon" }]) {
  return makeAuthContext({
    user: makeAuthUser({
      permissions: {
        "stock.view": true,
        "stock.transfer": true,
      },
      pharmacies,
    }),
  });
}

describe("TransferBatchModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    transferBatchMock.mockResolvedValue(transferResponse());
  });

  it("lists destination pharmacies excluding the source pharmacy", () => {
    renderWithProviders(
      <TransferBatchModal
        batch={makeBatch()}
        isOpen
        onClose={vi.fn()}
        sourcePharmacyId={1}
      />,
      { auth: transferAuth() },
    );

    expect(screen.getByRole("option", { name: "JMW Croydon" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "JMW Sutton" })).toBeNull();
  });

  it("submitting valid form calls transferBatch with numeric values", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TransferBatchModal
        batch={makeBatch()}
        isOpen
        onClose={vi.fn()}
        sourcePharmacyId={1}
      />,
      { auth: transferAuth() },
    );

    await user.selectOptions(screen.getByLabelText("Destination pharmacy"), "2");
    await user.type(screen.getByLabelText("Quantity"), "4");
    await user.type(screen.getByLabelText("Reason"), "Branch support");
    await user.type(screen.getByLabelText("Reference"), "TRF-001");
    await user.click(screen.getByRole("button", { name: "Transfer stock" }));

    await waitFor(() => {
      expect(transferBatchMock).toHaveBeenCalledWith(30, {
        destination_pharmacy: 2,
        quantity: 4,
        reason: "Branch support",
        reference: "TRF-001",
      });
    });
  });

  it("disables submit and shows note when there is no destination pharmacy", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TransferBatchModal
        batch={makeBatch()}
        isOpen
        onClose={vi.fn()}
        sourcePharmacyId={1}
      />,
      { auth: transferAuth([{ id: 1, name: "JMW Sutton" }]) },
    );

    expect(
      screen.getByText("No other pharmacy is available to transfer to."),
    ).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Transfer stock" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(transferBatchMock).not.toHaveBeenCalled();
  });

  it("renders backend destination pharmacy errors", async () => {
    transferBatchMock.mockRejectedValue(
      new ApiError(400, {
        destination_pharmacy: [
          "Destination pharmacy must be in the same group as the source.",
        ],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TransferBatchModal
        batch={makeBatch()}
        isOpen
        onClose={vi.fn()}
        sourcePharmacyId={1}
      />,
      { auth: transferAuth() },
    );

    await user.selectOptions(screen.getByLabelText("Destination pharmacy"), "2");
    await user.type(screen.getByLabelText("Quantity"), "4");
    await user.click(screen.getByRole("button", { name: "Transfer stock" }));

    expect(
      await screen.findByText(
        "Destination pharmacy must be in the same group as the source.",
      ),
    ).toBeInTheDocument();
  });

  it("renders backend quantity errors", async () => {
    transferBatchMock.mockRejectedValue(
      new ApiError(400, {
        quantity: ["Insufficient stock in the source batch."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TransferBatchModal
        batch={makeBatch()}
        isOpen
        onClose={vi.fn()}
        sourcePharmacyId={1}
      />,
      { auth: transferAuth() },
    );

    await user.selectOptions(screen.getByLabelText("Destination pharmacy"), "2");
    await user.type(screen.getByLabelText("Quantity"), "99");
    await user.click(screen.getByRole("button", { name: "Transfer stock" }));

    expect(
      await screen.findByText("Insufficient stock in the source batch."),
    ).toBeInTheDocument();
  });

  it("renders backend batch errors", async () => {
    transferBatchMock.mockRejectedValue(
      new ApiError(400, {
        batch: ["Cannot transfer from an inactive batch."],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <TransferBatchModal
        batch={makeBatch()}
        isOpen
        onClose={vi.fn()}
        sourcePharmacyId={1}
      />,
      { auth: transferAuth() },
    );

    await user.selectOptions(screen.getByLabelText("Destination pharmacy"), "2");
    await user.type(screen.getByLabelText("Quantity"), "4");
    await user.click(screen.getByRole("button", { name: "Transfer stock" }));

    expect(
      await screen.findByText("Cannot transfer from an inactive batch."),
    ).toBeInTheDocument();
  });
});
