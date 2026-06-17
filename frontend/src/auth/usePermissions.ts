import { useAuth } from "./AuthContext";

export function usePermissions() {
  const { user } = useAuth();

  return {
    role: user?.role ?? null,
    isGlobal: user?.scope.is_global ?? false,
    // UX-only filtering; the backend remains the source of truth for permissions.
    can: (action: string) => !!user?.permissions?.[action],
  };
}
