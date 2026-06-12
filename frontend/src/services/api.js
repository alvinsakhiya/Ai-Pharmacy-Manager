import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

export const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";
export const AUTH_TOKEN_REFRESHED_EVENT = "auth:token-refreshed";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
});

let activeRefreshRequest = null;

function isAuthenticationRequest(url = "") {
  return url.includes("/auth/login/") || url.includes("/auth/refresh/");
}

export function clearStoredAuthTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

function expireSession() {
  clearStoredAuthTokens();
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}

api.interceptors.request.use((request) => {
  const accessToken = localStorage.getItem("accessToken");

  if (accessToken && !isAuthenticationRequest(request.url)) {
    request.headers.Authorization = `Bearer ${accessToken}`;
  }

  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = localStorage.getItem("refreshToken");

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      isAuthenticationRequest(originalRequest?.url) ||
      !refreshToken
    ) {
      if (error.response?.status === 401 && !isAuthenticationRequest(originalRequest?.url)) {
        expireSession();
      }

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!activeRefreshRequest) {
        activeRefreshRequest = refreshClient
          .post("/auth/refresh/", { refresh: refreshToken })
          .then((response) => {
            const { access, refresh } = response.data;

            localStorage.setItem("accessToken", access);

            if (refresh) {
              localStorage.setItem("refreshToken", refresh);
            }

            window.dispatchEvent(
              new CustomEvent(AUTH_TOKEN_REFRESHED_EVENT, { detail: access })
            );

            return access;
          })
          .finally(() => {
            activeRefreshRequest = null;
          });
      }

      const accessToken = await activeRefreshRequest;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      expireSession();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
