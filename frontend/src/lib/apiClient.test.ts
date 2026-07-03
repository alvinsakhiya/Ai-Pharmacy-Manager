import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api";
import { ApiError, requestJson, SESSION_EXPIRED_EVENT } from "./apiClient";

vi.mock("./api", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(status: number, body: unknown = null): Response {
  return new Response(body === null ? "" : JSON.stringify(body), { status });
}

describe("requestJson", () => {
  const sessionExpiredListener = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    window.addEventListener(SESSION_EXPIRED_EVENT, sessionExpiredListener);
  });

  afterEach(() => {
    window.removeEventListener(SESSION_EXPIRED_EVENT, sessionExpiredListener);
  });

  it("returns the parsed body on success", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { id: 1 }));

    await expect(requestJson("/api/patients/1/")).resolves.toEqual({ id: 1 });
    expect(sessionExpiredListener).not.toHaveBeenCalled();
  });

  it("throws ApiError without announcing session expiry on validation errors", async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(400, { name: ["This field is required."] }),
    );

    const error = await requestJson("/api/patients/").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).data).toEqual({
      name: ["This field is required."],
    });
    expect(sessionExpiredListener).not.toHaveBeenCalled();
  });

  it("surfaces non-JSON error bodies as ApiError with the right status", async () => {
    apiFetchMock.mockResolvedValue(
      new Response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
      }),
    );

    const error = await requestJson("/api/patients/").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).data).toBeNull();
  });

  it("still announces session expiry when a 401 has a non-JSON body", async () => {
    apiFetchMock.mockResolvedValue(
      new Response("<html><body>Signed out</body></html>", { status: 401 }),
    );

    await expect(requestJson("/api/patients/")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(sessionExpiredListener).toHaveBeenCalledTimes(1);
  });

  it("announces session expiry on 401", async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(401, { detail: "Authentication credentials were not provided." }),
    );

    await expect(requestJson("/api/patients/")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(sessionExpiredListener).toHaveBeenCalledTimes(1);
  });

  it("treats 403 as a permission denial when the session is still live", async () => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse(403, { detail: "Forbidden." }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 3 }));

    await expect(requestJson("/api/users/")).rejects.toBeInstanceOf(ApiError);

    await vi.waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/me/");
    });
    expect(sessionExpiredListener).not.toHaveBeenCalled();
  });

  it("treats 403 as session expiry when the auth check also fails", async () => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse(403, { detail: "Forbidden." }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Session expired." }));

    await expect(requestJson("/api/users/")).rejects.toBeInstanceOf(ApiError);

    await vi.waitFor(() => {
      expect(sessionExpiredListener).toHaveBeenCalledTimes(1);
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/me/");
  });
});
