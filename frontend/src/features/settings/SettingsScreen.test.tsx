import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderWithProviders } from "../../test/providers";
import { SettingsScreen } from "./SettingsScreen";

describe("SettingsScreen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.fontSize = "";
  });

  afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.style.fontSize = "";
  });

  it("renders the accessibility controls", () => {
    renderWithProviders(<SettingsScreen />);
    expect(
      screen.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Contrast" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Text size" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Reduce motion" }),
    ).toBeInTheDocument();
  });

  it("enables high contrast and persists it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.click(screen.getByRole("radio", { name: "High" }));

    await waitFor(() => {
      expect(document.documentElement.classList.contains("contrast-high")).toBe(
        true,
      );
    });
    expect(window.localStorage.getItem("apm.preferences")).toContain("high");
  });

  it("applies a larger text scale", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.click(screen.getByRole("radio", { name: "Larger" }));

    await waitFor(() => {
      expect(document.documentElement.style.fontSize).toBe("125%");
    });
  });

  it("toggles reduce motion on and off", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    const toggle = screen.getByRole("switch", { name: "Reduce motion" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("reduce-motion")).toBe(
        true,
      );
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
