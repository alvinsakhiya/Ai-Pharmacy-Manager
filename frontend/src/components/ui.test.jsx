import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./ui";

describe("Modal", () => {
  it("labels the dialog, focuses close, and handles Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Stock adjustment">
        <button type="button">Confirm</button>
      </Modal>
    );

    expect(
      screen.getByRole("dialog", { name: "Stock adjustment" })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus()
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
