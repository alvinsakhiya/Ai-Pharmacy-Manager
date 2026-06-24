import { useState } from "react";

import { AlertTriangle, Layers, Pencil, Plus } from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui/Table";
import { GroupFormModal } from "./GroupFormModal";
import type { Group } from "./tenancyApi";
import { useGroupsQuery } from "./useTenancy";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function GroupsSection() {
  const { can } = usePermissions();
  const canManageGroups = can("group.manage");
  const groupsQuery = useGroupsQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  function openCreateModal() {
    setEditingGroup(null);
    setModalOpen(true);
  }

  function openEditModal(group: Group) {
    setEditingGroup(group);
    setModalOpen(true);
  }

  return (
    <Panel>
      <PanelHeader
        icon={<Layers className="h-[18px] w-[18px]" />}
        title="Groups"
        subtitle="Manage pharmacy organisation groups."
        actions={
          canManageGroups ? (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={openCreateModal}
            >
              Create group
            </Button>
          ) : null
        }
      />
      <PanelBody>
        {groupsQuery.isLoading ? <SkeletonRows rows={4} /> : null}

        {groupsQuery.isError ? (
          <EmptyState
            tone="danger"
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Could not load groups."
            description="Please retry. Your session or permissions may need refreshing."
            action={
              <Button variant="danger" onClick={() => void groupsQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : null}

        {groupsQuery.isSuccess && groupsQuery.data.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-6 w-6" />}
            title="No groups yet."
            description="Create your first organisation group to start adding pharmacies."
            action={
              canManageGroups ? (
                <Button
                  variant="primary"
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={openCreateModal}
                >
                  Create group
                </Button>
              ) : null
            }
          />
        ) : null}

        {groupsQuery.isSuccess && groupsQuery.data.length > 0 ? (
          <TableScroll>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Slug</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {groupsQuery.data.map((group) => (
                  <TR key={group.id}>
                    <TD className="whitespace-nowrap font-semibold text-ink">
                      {group.name}
                    </TD>
                    <TD className="whitespace-nowrap font-mono text-muted">
                      {group.slug}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <Badge
                        variant={group.is_active ? "success" : "neutral"}
                        dot
                      >
                        {group.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TD>
                    <TD className="tnum whitespace-nowrap text-muted">
                      {formatDate(group.created_at)}
                    </TD>
                    <TD className="whitespace-nowrap text-right">
                      {canManageGroups ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => openEditModal(group)}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableScroll>
        ) : null}
      </PanelBody>

      <GroupFormModal
        group={editingGroup}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Panel>
  );
}
