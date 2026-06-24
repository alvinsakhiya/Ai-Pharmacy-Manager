/**
 * Tiny class-name joiner. Filters out falsy values so conditional classes read
 * cleanly: cn("base", active && "is-active", disabled ? "opacity-50" : null).
 */
export type ClassValue = string | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
