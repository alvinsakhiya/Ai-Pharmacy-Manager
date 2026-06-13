import { useEffect, useState } from "react";
import api, {
  AUTH_SESSION_EXPIRED_EVENT,
  AUTH_TOKEN_REFRESHED_EVENT,
  clearStoredAuthTokens,
} from "../services/api";
import AuthContext from "./auth-context";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("authUser"));
  } catch {
    localStorage.removeItem("authUser");
    return null;
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken")
  );
  const [user, setUser] = useState(readStoredUser);
  const [isProfileLoading, setIsProfileLoading] = useState(
    Boolean(accessToken && !user)
  );
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    const handleSessionExpired = () => {
      // Lets the login page explain why the user was signed out.
      sessionStorage.setItem("sessionExpired", "true");
      setAccessToken(null);
      setUser(null);
      setIsProfileLoading(false);
      setProfileError("");
    };
    const handleTokenRefreshed = (event) => setAccessToken(event.detail);

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    let isActive = true;

    api
      .get("/auth/me/")
      .then((response) => {
        if (!isActive) {
          return;
        }

        localStorage.setItem("authUser", JSON.stringify(response.data));
        setUser(response.data);
        setProfileError("");
      })
      .catch(() => {
        if (isActive) {
          setProfileError("Your staff access profile could not be verified.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsProfileLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [accessToken]);

  const login = async (username, password) => {
    const response = await api.post("/auth/login/", {
      username,
      password,
    });

    const { access, refresh, user: authenticatedUser } = response.data;

    localStorage.setItem("accessToken", access);
    localStorage.setItem("refreshToken", refresh);
    localStorage.setItem("authUser", JSON.stringify(authenticatedUser));

    setAccessToken(access);
    setUser(authenticatedUser);
    setIsProfileLoading(false);
    setProfileError("");

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
    setUser(null);
    setProfileError("");
  };

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isAuthenticated: Boolean(accessToken),
        isProfileLoading,
        profileError,
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
