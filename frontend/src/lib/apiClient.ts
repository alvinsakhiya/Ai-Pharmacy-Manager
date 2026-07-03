import { apiFetch } from "./api";

export const SESSION_EXPIRED_EVENT = "app:session-expired";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super("Request failed.");
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    // Reverse proxies can answer with HTML error pages. Surface those as a
    // normal ApiError with the right status (so session-expiry detection and
    // the no-retry-on-4xx policy still apply) instead of a SyntaxError.
    return null;
  }
}

function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

let sessionCheck: Promise<void> | null = null;

// Session-cookie auth reports an expired session as 401 or 403 depending on
// the endpoint, and 403 is also how a live session is told it lacks
// permission. Confirm against /api/auth/me/ before treating 403 as expiry.
function verifySessionAfterForbidden(): Promise<void> {
  sessionCheck ??= apiFetch("/api/auth/me/")
    .then((response) => {
      if (response.status === 401 || response.status === 403) {
        notifySessionExpired();
      }
    })
    .catch(() => undefined)
    .finally(() => {
      sessionCheck = null;
    });
  return sessionCheck;
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  const data = await parseJson(response);

  if (!response.ok) {
    if (response.status === 401) {
      notifySessionExpired();
    } else if (response.status === 403) {
      void verifySessionAfterForbidden();
    }
    throw new ApiError(response.status, data);
  }

  return data as T;
}
