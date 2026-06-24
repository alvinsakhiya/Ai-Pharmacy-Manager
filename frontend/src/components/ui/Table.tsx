import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

import { cn } from "../../lib/cn";

/**
 * Data table house style. Sticky-capable header, hairline dividers (zebra-free),
 * hover rows, tabular numbers, compact pro density. Use the components for new
 * tables; the exported class constants let existing raw tables adopt the style
 * without restructuring.
 */

export const tableClass = "w-full border-collapse text-sm";
export const theadClass = "border-b border-line";
export const thClass =
  "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-muted";
export const tdClass = "px-3 py-3 align-middle text-[13px] text-ink-soft";
export const trClass =
  "border-b border-line/70 transition-colors duration-150 ease-soft last:border-0 hover:bg-surface-subtle";

/** Scroll container + bordered surface for a table. Drop a <Table> inside. */
export function TableScroll({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-line bg-surface shadow-soft",
        className,
      )}
      {...rest}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({
  className,
  children,
  ...rest
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn(tableClass, className)} {...rest}>
      {children}
    </table>
  );
}

export function THead({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn(theadClass, className)} {...rest}>
      {children}
    </thead>
  );
}

export function TBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...rest}>
      {children}
    </tbody>
  );
}

export function TR({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn(trClass, className)} {...rest}>
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn(thClass, className)} scope="col" {...rest}>
      {children}
    </th>
  );
}

export function TD({
  className,
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn(tdClass, className)} {...rest}>
      {children}
    </td>
  );
}
