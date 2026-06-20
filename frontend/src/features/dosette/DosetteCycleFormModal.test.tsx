import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import { renderWithProviders } from "../../test/providers";
import type { DosetteCycle } from "./dosetteApi";
import * as dosetteApi from "./dosetteApi";
import { DosetteCycleFormModal } from "./DosetteCycleFormModal";

vi.mock("./dosetteApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dosetteApi")>();
  return {
    ...actual,
    createDosetteCycle: vi.fn(),
    updateDosetteCycle: vi.fn(),
  };
});

const createDosetteCycleMock = vi.mocked(dosetteApi.createDosetteCycle);
const updateDosetteCycleMock = vi.mocked(dosetteApi.updateDosetteCycle);

function makeCycle(overrides: Partial<DosetteCycle> = {}): DosetteCycle {
  return {
    id: 40,
    reference: "MDS-2026-W26",
    frequency: "WEEKLY",
    start_date: "2026-06-22",
    end_date: "2026-06-28",
    status: "DRAFT",
    created_at: "2026-06-19T09:00:00Z",
    updated_at: "2026-06-19T09:00:00Z",
    ...overrides,
  };
}

function renderModal({
  cycle = null,
  onClose = vi.fn(),
}: {
  cycle?: DosetteCycle | null;
  onClose?: () => void;
} = {}) {
  renderWithProviders(
    <DosetteCycleFormModal
      cycle={cycle}
      isOpen
      onClose={onClose}
      patientId={20}
    />,
  );
  return { onClose };
}

describe("DosetteCycleFormModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createDosetteCycleMock.mockResolvedValue(makeCycle());
    updateDosetteCycleMock.mockResolvedValue(makeCycle());
  });

  it("submits create payload", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByLabelText("Reference"), "MDS-2026-FW08");
    await user.selectOptions(screen.getByLabelText("Frequency"), "FOUR_WEEKLY");
    await user.type(screen.getByLabelText("Start date"), "2026-07-01");
    await user.type(screen.getByLabelText("End date"), "2026-07-28");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createDosetteCycleMock).toHaveBeenCalledWith(20, {
        reference: "MDS-2026-FW08",
        frequency: "FOUR_WEEKLY",
        start_date: "2026-07-01",
        end_date: "2026-07-28",
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("submits edit payload", async () => {
    const user = userEvent.setup();
    renderModal({ cycle: makeCycle() });

    await user.clear(screen.getByLabelText("Reference"));
    await user.type(screen.getByLabelText("Reference"), "MDS-2026-W27");
    await user.selectOptions(screen.getByLabelText("Frequency"), "FORTNIGHTLY");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateDosetteCycleMock).toHaveBeenCalledWith(20, 40, {
        reference: "MDS-2026-W27",
        frequency: "FORTNIGHTLY",
        start_date: "2026-06-22",
        end_date: "2026-06-28",
      });
    });
  });

  it("renders backend field errors", async () => {
    const user = userEvent.setup();
    createDosetteCycleMock.mockRejectedValue(
      new ApiError(400, {
        reference: ["A cycle with this reference already exists for this patient."],
        end_date: ["End date cannot be before the start date."],
      }),
    );
    renderModal();

    await user.type(screen.getByLabelText("Reference"), "MDS-2026-W26");
    await user.type(screen.getByLabelText("Start date"), "2026-07-10");
    await user.type(screen.getByLabelText("End date"), "2026-07-01");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "A cycle with this reference already exists for this patient.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("End date cannot be before the start date."),
    ).toBeInTheDocument();
  });

  it("does not render status field", () => {
    renderModal({ cycle: makeCycle({ status: "PREPARED" }) });

    expect(screen.queryByLabelText("Status")).toBeNull();
    expect(screen.queryByDisplayValue("PREPARED")).toBeNull();
  });
});
