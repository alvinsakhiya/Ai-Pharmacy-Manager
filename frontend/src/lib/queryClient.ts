import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./apiClient";

// 4xx responses (session expiry, permission denials, validation errors) are
// not transient — retrying them only delays the error state on screen.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false;
  }
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
    },
  },
});
