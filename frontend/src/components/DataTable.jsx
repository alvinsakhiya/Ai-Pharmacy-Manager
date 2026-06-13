import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cx } from "./ui";

/** Pro data table: sticky header, hairline rows, hover, sortable, tabular nums. */
export function DataTable({ columns, rows, rowKey = "id", onRowClick, dense, sortable = true }) {
  const [sort, setSort] = useState({ key: null, dir: 1 });

  let data = rows || [];
  if (sort.key) {
    const col = columns.find((c) => c.key === sort.key);
    const accessor = col?.sortAccessor || ((r) => r[sort.key]);
    data = [...data].sort((a, b) => {
      const av = accessor(a), bv = accessor(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
    });
  }

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((c) => (
              <th
                key={c.key}
                aria-sort={
                  sortable && c.sortable !== false && sort.key === c.key
                    ? sort.dir === 1 ? "ascending" : "descending"
                    : undefined
                }
                className={cx(
                  "sticky top-0 z-10 bg-surface px-3 py-2.5 text-left text-micro uppercase text-text-tertiary select-none",
                  c.align === "right" && "text-right",
                  c.className
                )}
              >
                {sortable && c.sortable !== false ? (
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cx(
                      "inline-flex items-center gap-1 rounded-sm hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent-ring",
                      c.align === "right" && "ml-auto"
                    )}
                  >
                    {c.header}
                    {sort.key === c.key &&
                      (sort.dir === 1
                        ? <ChevronUp size={12} aria-hidden="true" />
                        : <ChevronDown size={12} aria-hidden="true" />)}
                  </button>
                ) : (
                  <span>{c.header}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row[rowKey]}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
              tabIndex={onRowClick ? 0 : undefined}
              className={cx(
                "border-b border-border-subtle transition-colors duration-150 ease",
                onRowClick && "cursor-pointer hover:bg-subtle focus-visible:bg-accent-soft focus-visible:outline-none"
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cx(
                    dense ? "px-3 py-2" : "px-3 py-2.5",
                    "text-text-primary",
                    c.align === "right" && "text-right tnum",
                    c.numeric && "tnum",
                    c.cellClassName
                  )}
                >
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
