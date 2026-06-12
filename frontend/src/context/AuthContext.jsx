import { createContext, useEffect, useState } from "react";
import api from "../services/api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken")
  );

  const [isAuthenticated, setIsAuthenticated] = useState(!!accessToken);

  useEffect(() => {
    setIsAuthenticated(!!accessToken);
  }, [accessToken]);

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
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}