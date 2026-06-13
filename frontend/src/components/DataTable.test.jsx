import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "./DataTable";

const columns = [
  { key: "name", header: "Name" },
  { key: "quantity", header: "Quantity", align: "right" },
];
const rows = [
  { id: 1, name: "Zulu", quantity: 2 },
  { id: 2, name: "Alpha", quantity: 4 },
];

describe("DataTable", () => {
  it("sorts from a keyboard-operable header control", () => {
    render(<DataTable columns={columns} rows={rows} />);

    fireEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
      "aria-sort",
      "ascending"
    );
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Alpha")).toBeInTheDocument();
  });

  it("opens a clickable row with Enter", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns} rows={rows} onRowClick={onRowClick} />
    );

    const row = screen.getAllByRole("row")[1];
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });

    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
