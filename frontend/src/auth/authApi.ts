import { apiFetch } from "../lib/api";
import type { MePayload } from "../types/auth";

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

async function jsonRequest<T>(
  path: string,
  body: Record<string, string>,
): Promise<ApiResult<T>> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    ok: response.ok,
    status: response.status,
    data: (await parseJson(response)) as T,
  };
}

export async function getCsrf(): Promise<void> {
  await apiFetch("/api/auth/csrf/");
}

export async function getMe(): Promise<MePayload | null> {
  const response = await apiFetch("/api/auth/me/");

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to fetch current user.");
  }

  return (await parseJson(response)) as MePayload;
}

export async function login(
  email: string,
  password: string,
): Promise<ApiResult<MePayload | unknown>> {
  return jsonRequest("/api/auth/login/", { email, password });
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout/", {
    method: "POST",
  });
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<ApiResult> {
  return jsonRequest("/api/auth/password/change/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
}
