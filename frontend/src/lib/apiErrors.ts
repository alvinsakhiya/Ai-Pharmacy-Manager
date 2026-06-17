import { ApiError } from "./apiClient";

export type FieldErrors = Record<string, string[]>;

export function normalizeErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== "object") {
    return { detail: ["Something went wrong. Please try again."] };
  }

  const normalized: FieldErrors = {};
  for (const [key, value] of Object.entries(error.data)) {
    if (Array.isArray(value)) {
      normalized[key] = value.map(String);
    } else if (typeof value === "string") {
      normalized[key] = [value];
    } else {
      normalized[key] = [String(value)];
    }
  }

  return normalized;
}

export function errorMessages(errors: FieldErrors, key: string): string[] {
  return errors[key] ?? [];
}
