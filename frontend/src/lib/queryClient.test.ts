import { describe, expect, it } from "vitest";

import { ApiError } from "./apiClient";
import { queryClient, shouldRetry } from "./queryClient";

describe("shouldRetry", () => {
  it("never retries 4xx responses", () => {
    for (const status of [400, 401, 403, 404]) {
      expect(shouldRetry(0, new ApiError(status, null))).toBe(false);
    }
  });

  it("retries server errors up to two times", () => {
    const error = new ApiError(500, null);

    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(1, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(false);
  });

  it("retries network failures up to two times", () => {
    const error = new TypeError("Failed to fetch");

    expect(shouldRetry(0, error)).toBe(true);
    expect(shouldRetry(2, error)).toBe(false);
  });
});

describe("queryClient", () => {
  it("uses the 4xx-aware retry policy by default", () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(shouldRetry);
  });
});
