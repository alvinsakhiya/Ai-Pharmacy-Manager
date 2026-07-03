/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { SESSION_EXPIRED_EVENT } from "../lib/apiClient";
import type { MePayload } from "../types/auth";
import * as authApi from "./authApi";

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: MePayload;
}

export interface AuthContextValue {
  user: MePayload | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  changePassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; errors?: unknown }>;
  refreshMe: () => Promise<void>;
}

function authErrorMessage(data: unknown): string {
  if (
    data &&
    typeof data === "object" &&
    "detail" in data &&
    typeof data.detail === "string"
  ) {
    return data.detail;
  }

  return "Unable to sign in with those credentials.";
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);

  // The API layer announces an expired session (401, or 403 confirmed against
  // /api/auth/me/). Drop the user so protected routes redirect to login, and
  // purge cached query data so nothing from the old session stays visible.
  useEffect(() => {
    function handleSessionExpired() {
      setUser(null);
      queryClient.clear();
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [queryClient]);

  const refreshMe = useCallback(async () => {
    const currentUser = await authApi.getMe();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await authApi.getCsrf();
        const currentUser = await authApi.getMe();
        if (active) {
          setUser(currentUser);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const response = await authApi.login(email, password);
        if (!response.ok) {
          return {
            ok: false,
            error: authErrorMessage(response.data),
          };
        }

        const nextUser = await authApi.getMe();
        if (nextUser === null) {
          return {
            ok: false,
            error: "Unable to confirm your session. Please try again.",
          };
        }

        // Purge any query data cached before this login so the new account
        // never sees another session's data.
        queryClient.clear();
        setUser(nextUser);
        return { ok: true, user: nextUser };
      } catch {
        return {
          ok: false,
          error: "Unable to sign in with those credentials.",
        };
      }
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Server-side logout can fail (network, already-expired session); the
      // local session still ends either way.
    } finally {
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      try {
        const response = await authApi.changePassword(oldPassword, newPassword);
        if (!response.ok) {
          return { ok: false, errors: response.data };
        }

        await refreshMe();
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [refreshMe],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      changePassword,
      refreshMe,
    }),
    [changePassword, loading, login, logout, refreshMe, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
