import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

import {
  AuthContext,
  type AuthContextValue,
} from "../auth/AuthContext";
import { ToastProvider } from "../components/ui/Toast";
import { PreferencesProvider } from "../app/PreferencesContext";
import type { MePayload } from "../types/auth";

export function makeAuthUser(overrides: Partial<MePayload> = {}): MePayload {
  return {
    id: 1,
    email: "admin@example.com",
    full_name: "Admin User",
    must_change_password: false,
    role: "ADMIN",
    scope: {
      is_global: true,
      group_ids: [],
      pharmacy_ids: [],
    },
    pharmacies: [],
    permissions: {
      "user.manage": true,
    },
    ...overrides,
  };
}

export function makeAuthContext(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    user: makeAuthUser(),
    loading: false,
    login: async () => ({ ok: true, user: makeAuthUser() }),
    logout: async () => undefined,
    changePassword: async () => ({ ok: true }),
    refreshMe: async () => undefined,
    ...overrides,
  };
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  {
    auth = makeAuthContext(),
    route = "/",
    queryClient = createTestQueryClient(),
    ...options
  }: RenderOptions & {
    auth?: AuthContextValue;
    route?: string;
    queryClient?: QueryClient;
  } = {},
) {
  return render(
    <PreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <ToastProvider>
            <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
          </ToastProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </PreferencesProvider>,
    options,
  );
}
