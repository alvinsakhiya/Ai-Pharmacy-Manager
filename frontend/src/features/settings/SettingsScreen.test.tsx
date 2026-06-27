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
      screen.getByRole("heading", { name: "Appearance" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Accessibility" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Motion" })).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Contrast" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Text size" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Focus visibility" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Colour vision mode"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Reduce motion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Dyslexia-friendly spacing" }),
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

    await user.click(screen.getByRole("radio", { name: "Extra large" }));

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

  it("applies enhanced focus, colour vision, and dyslexia spacing preferences", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.click(screen.getByRole("radio", { name: "Enhanced" }));
    await user.selectOptions(
      screen.getByLabelText("Colour vision mode"),
      "deuteranopia",
    );
    await user.click(
      screen.getByRole("switch", { name: "Dyslexia-friendly spacing" }),
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains("focus-enhanced")).toBe(
        true,
      );
      expect(
        document.documentElement.classList.contains("colour-deuteranopia"),
      ).toBe(true);
      expect(
        document.documentElement.classList.contains("dyslexia-spacing"),
      ).toBe(true);
    });
    expect(window.localStorage.getItem("apm.preferences")).toContain(
      "deuteranopia",
    );
  });

  it("renders printer preferences with label paper options", () => {
    renderWithProviders(<SettingsScreen />);

    expect(
      screen.getByRole("heading", { name: "Printer preferences" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Default paper size")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "A4" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "A5" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "4x6 label" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "72x36 label" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Orientation")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Portrait" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Landscape" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Label printer note")).toBeInTheDocument();
  });

  it("persists printer preferences and resets to defaults", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsScreen />);

    await user.selectOptions(screen.getByLabelText("Default paper size"), "a5");
    await user.selectOptions(screen.getByLabelText("Orientation"), "landscape");
    await user.selectOptions(screen.getByLabelText("Print scale"), "actual");
    await user.selectOptions(screen.getByLabelText("Default copies"), "3");
    await user.selectOptions(
      screen.getByLabelText("Default output type"),
      "stock_label",
    );
    await user.type(screen.getByLabelText("Label printer note"), "Zebra ZD230");

    await waitFor(() => {
      const stored = window.localStorage.getItem("apm.preferences");
      expect(stored).toContain("a5");
      expect(stored).toContain("landscape");
      expect(stored).toContain("actual");
      expect(stored).toContain("stock_label");
      expect(stored).toContain("Zebra ZD230");
    });

    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Default paper size")).toHaveValue("a4");
      expect(screen.getByLabelText("Orientation")).toHaveValue("portrait");
      expect(screen.getByLabelText("Print scale")).toHaveValue("fit");
      expect(screen.getByLabelText("Default copies")).toHaveValue("1");
      expect(screen.getByLabelText("Default output type")).toHaveValue(
        "dosette_tray",
      );
      expect(screen.getByLabelText("Label printer note")).toHaveValue("");
    });
  });
});
