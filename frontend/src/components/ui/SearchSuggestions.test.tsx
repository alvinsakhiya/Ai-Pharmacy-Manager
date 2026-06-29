import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchSuggestions } from "./SearchSuggestions";

const suggestions = [
  {
    id: "patient-1",
    label: "Polish Matthew",
    description: "SUT-P1",
  },
];

describe("SearchSuggestions", () => {
  it("renders suggestions in a labelled listbox", () => {
    render(
      <SearchSuggestions
        suggestions={suggestions}
        onPick={vi.fn()}
        label="Patient matches"
      />,
    );

    expect(
      screen.getByRole("listbox", { name: "Patient matches" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Polish Matthew/ })).toBeInTheDocument();
  });

  it("fires the click handler for a suggestion", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();

    render(
      <SearchSuggestions
        suggestions={suggestions}
        onPick={onPick}
        label="Patient matches"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Polish Matthew/ }));

    expect(onPick).toHaveBeenCalledWith(suggestions[0]);
  });

  it("calls onClose when Escape is pressed inside the suggestion panel", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <SearchSuggestions
        suggestions={suggestions}
        onPick={vi.fn()}
        label="Patient matches"
        onClose={onClose}
      />,
    );

    screen.getByRole("button", { name: /Polish Matthew/ }).focus();
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
