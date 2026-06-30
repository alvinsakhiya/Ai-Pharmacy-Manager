import { afterEach, describe, expect, it, vi } from "vitest";

function clearCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe("apiFetch", () => {
  afterEach(() => {
    clearCookie("csrftoken");
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses relative API paths by default and includes credentials", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("./api");
    await apiFetch("/api/auth/me/");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me/",
      expect.objectContaining({
        credentials: "include",
      }),
    );
  });

  it("uses an absolute API base URL when explicitly configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000/");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("./api");
    await apiFetch("/api/auth/me/");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/me/",
      expect.objectContaining({
        credentials: "include",
      }),
    );
  });

  it("adds the CSRF token for unsafe methods without changing the body", async () => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await import("./api");
    await apiFetch("/api/auth/login/", {
      body: JSON.stringify({
        email: "pharmacist@demo.local",
        password: " DemoPass!2026 ",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(options).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          email: "pharmacist@demo.local",
          password: " DemoPass!2026 ",
        }),
        credentials: "include",
        method: "POST",
      }),
    );
    expect((options as RequestInit).headers).toEqual(expect.any(Headers));
    expect(((options as RequestInit).headers as Headers).get("X-CSRFToken")).toBe(
      "test-csrf-token",
    );
  });
});
