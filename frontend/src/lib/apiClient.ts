import { apiFetch } from "./api";

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
  return JSON.parse(text);
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  const data = await parseJson(response);

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data as T;
}
