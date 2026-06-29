import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Logo } from "./Logo";

describe("Logo", () => {
  it("is an accessible image when the mark stands alone", () => {
    render(<Logo />);

    expect(
      screen.getByRole("img", { name: "AI Pharmacy Manager" }),
    ).toBeInTheDocument();
  });

  it("is decorative when a visible wordmark already names the brand", () => {
    const { container } = render(<Logo decorative />);

    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
