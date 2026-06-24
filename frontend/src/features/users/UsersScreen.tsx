import { useState } from "react";
import { AlertTriangle, UserPlus, Users as UsersIcon } from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { CreateUserModal } from "./CreateUserModal";
import { UsersTable } from "./UsersTable";
import { useUsersQuery } from "./useUsers";

export function UsersScreen() {
  const { can } = usePermissions();
  const canManageUsers = can("user.manage");
  const usersQuery = useUsersQuery();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="User management"
        title="Users"
        subtitle="View users in your permitted scope, create new accounts, deactivate users, and issue temporary password resets."
        actions={
          canManageUsers ? (
            <Button
              leadingIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => setCreateModalOpen(true)}
              type="button"
              variant="primary"
            >
              Create user
            </Button>
          ) : null
        }
      />

      {usersQuery.isLoading ? (
        <Panel>
          <PanelBody>
            <SkeletonRows rows={6} />
          </PanelBody>
        </Panel>
      ) : null}

      {usersQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Could not load users."
          description="Please retry. If this continues, your session or permissions may need refreshing."
          action={
            <Button
              onClick={() => void usersQuery.refetch()}
              type="button"
              variant="danger"
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {usersQuery.isSuccess && usersQuery.data.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-6 w-6" />}
          title="No users in your scope yet."
          description="Create the first account to give your team access to this workspace."
          action={
            canManageUsers ? (
              <Button
                leadingIcon={<UserPlus className="h-4 w-4" />}
                onClick={() => setCreateModalOpen(true)}
                type="button"
                variant="primary"
              >
                Create user
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {usersQuery.isSuccess && usersQuery.data.length > 0 ? (
        <UsersTable users={usersQuery.data} />
      ) : null}

      <CreateUserModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
