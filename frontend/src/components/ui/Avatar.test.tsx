import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders deterministic initials and accessible label", () => {
    const { rerender } = render(
      <Avatar seed="Polish Matthew" label="Polish Matthew" />,
    );

    const avatar = screen.getByRole("img", { name: "Polish Matthew" });
    expect(avatar).toHaveTextContent("PM");
    const firstClassName = avatar.className;

    rerender(<Avatar seed="Polish Matthew" label="Polish Matthew" />);
    expect(screen.getByRole("img", { name: "Polish Matthew" }).className).toBe(
      firstClassName,
    );
  });

  it("does not use an external image URL", () => {
    const { container } = render(<Avatar seed="admin@example.com" />);

    expect(container.querySelector("img")).toBeNull();
  });
});
