import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppLogo } from "./AppLogo";

describe("AppLogo", () => {
  it("renders the icon variant as an accessible image", () => {
    render(<AppLogo variant="icon" label="AI Pharmacy Manager" />);

    expect(
      screen.getByRole("img", { name: "AI Pharmacy Manager" }),
    ).toBeInTheDocument();
  });

  it("renders a decorative icon (aria-hidden, no image role) when asked", () => {
    const { container } = render(<AppLogo variant="icon" decorative />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("renders the full wordmark with a decorative mark and a lilac AI accent", () => {
    const { container } = render(
      <AppLogo variant="full" tagline="Operational workspace" />,
    );

    expect(document.body).toHaveTextContent("AI Pharmacy Manager");
    expect(screen.getByText("Operational workspace")).toBeInTheDocument();

    const accent = screen.getByText("AI");
    expect(accent).toHaveClass("text-lilac");

    // Mark is decorative when the wordmark carries the name.
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the brand accent for the compact variant on light surfaces", () => {
    render(<AppLogo variant="compact" tone="onLight" />);

    expect(document.body).toHaveTextContent("AI Pharmacy Manager");
    expect(screen.getByText("AI")).toHaveClass("text-brand");
  });

  it("draws a solid mark with no glass/translucent utilities", () => {
    const { container } = render(<AppLogo variant="icon" />);
    const markup = container.innerHTML;

    for (const forbidden of ["backdrop-blur", "rgba(", "radial-gradient"]) {
      expect(markup).not.toContain(forbidden);
    }
  });
});
