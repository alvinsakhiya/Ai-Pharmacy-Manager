import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLogo } from "./AppLogo";

describe("AppLogo", () => {
  it("renders the icon variant as an accessible image", () => {
    const { container } = render(
      <AppLogo variant="icon" label="AI Pharmacy Manager" />,
    );

    expect(
      screen.getByRole("img", { name: "AI Pharmacy Manager" }),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a decorative icon when asked", () => {
    const { container } = render(<AppLogo variant="icon" decorative />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("renders a readable full brand lockup with real text", () => {
    const { container } = render(
      <AppLogo variant="full" tagline="Operational workspace" />,
    );

    expect(screen.getByText("AI")).toHaveClass("text-lilac");
    expect(document.body).toHaveTextContent("AI Pharmacy Manager");
    expect(screen.getByText("Operational workspace")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "AI Pharmacy Manager" })).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the brand accent for the compact variant on light surfaces", () => {
    render(<AppLogo variant="compact" tone="onLight" />);

    expect(document.body).toHaveTextContent("AI Pharmacy Manager");
    expect(screen.getByText("AI")).toHaveClass("text-brand");
  });

  it("does not use full horizontal uploaded logo images in the app lockup", () => {
    const { container } = render(<AppLogo variant="full" />);
    const markup = container.innerHTML;

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(markup).not.toContain("ai-pharmacy-manager-logo-header");
    expect(markup).not.toContain("white-bg");
  });

  it("draws a solid mark with no glass/translucent utilities", () => {
    const { container } = render(<AppLogo variant="icon" />);
    const markup = container.innerHTML;

    for (const forbidden of ["backdrop-blur", "rgba(", "radial-gradient"]) {
      expect(markup).not.toContain(forbidden);
    }
  });
});
