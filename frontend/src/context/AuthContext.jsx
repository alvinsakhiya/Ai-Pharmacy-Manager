import { useEffect, useState } from "react";
import api, {
  AUTH_SESSION_EXPIRED_EVENT,
  AUTH_TOKEN_REFRESHED_EVENT,
  clearStoredAuthTokens,
} from "../services/api";
import AuthContext from "./auth-context";

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken")
  );

  useEffect(() => {
    const handleSessionExpired = () => {
      // Lets the login page explain why the user was signed out.
      sessionStorage.setItem("sessionExpired", "true");
      setAccessToken(null);
    };
    const handleTokenRefreshed = (event) => setAccessToken(event.detail);

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
    };
  }, []);

  const login = async (username, password) => {
    const response = await api.post("/auth/login/", {
      username,
      password,
    });

    const { access, refresh } = response.data;

    localStorage.setItem("accessToken", access);
    localStorage.setItem("refreshToken", refresh);

    setAccessToken(access);

    return response.data;
  };

  const logout = () => {
    if (accessToken) {
      void api
        .post(
          "/auth/logout/",
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )
        .catch(() => {});
    }

    clearStoredAuthTokens();
    setAccessToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isAuthenticated: Boolean(accessToken),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
