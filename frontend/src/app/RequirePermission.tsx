import type { ReactNode } from "react";

import { usePermissions } from "../auth/usePermissions";

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
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-950">
        You don&apos;t have access to this section.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        Your account is signed in, but the backend permissions for this section
        are not present in your current session.
      </p>
    </section>
  );
}
