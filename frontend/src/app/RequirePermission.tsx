import type { ReactNode } from "react";
import { Lock } from "lucide-react";

import { usePermissions } from "../auth/usePermissions";
import { EmptyState } from "../components/ui/EmptyState";

interface RequirePermissionProps {
  anyOf: string[];
  children: ReactNode;
}

export function RequirePermission({ anyOf, children }: RequirePermissionProps) {
  const { can } = usePermissions();

  if (anyOf.some((permission) => can(permission))) {
    return children;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
      <EmptyState
        className="w-full animate-fade-in-up"
        icon={<Lock className="h-5 w-5" aria-hidden="true" />}
        title="You don't have access to this section."
        description="Your account is signed in, but the backend permissions for this section are not present in your current session."
      />
    </div>
  );
}
