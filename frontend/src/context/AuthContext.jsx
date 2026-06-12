import { useState } from "react";
import api from "../services/api";
import AuthContext from "./auth-context";

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken")
  );

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
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
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
