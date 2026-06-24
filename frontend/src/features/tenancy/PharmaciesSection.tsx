import { useMemo, useState } from "react";

import { AlertTriangle, Pencil, Plus, Store } from "lucide-react";

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
import { PharmacyFormModal } from "./PharmacyFormModal";
import type { Pharmacy } from "./tenancyApi";
import { useGroupsQuery, usePharmaciesQuery } from "./useTenancy";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PharmaciesSection() {
  const { can } = usePermissions();
  const canManagePharmacies = can("pharmacy.manage");
  const pharmaciesQuery = usePharmaciesQuery();
  const groupsQuery = useGroupsQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);

  const groupIdToName = useMemo(() => {
    return new Map((groupsQuery.data ?? []).map((group) => [group.id, group.name]));
  }, [groupsQuery.data]);

  function openCreateModal() {
    setEditingPharmacy(null);
    setModalOpen(true);
  }

  function openEditModal(pharmacy: Pharmacy) {
    setEditingPharmacy(pharmacy);
    setModalOpen(true);
  }

  return (
    <Panel>
      <PanelHeader
        icon={<Store className="h-[18px] w-[18px]" />}
        title="Pharmacies"
        subtitle="Manage pharmacies within organisation groups."
        actions={
          canManagePharmacies ? (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={openCreateModal}
            >
              Create pharmacy
            </Button>
          ) : null
        }
      />
      <PanelBody>
        {pharmaciesQuery.isLoading ? <SkeletonRows rows={4} /> : null}

        {pharmaciesQuery.isError ? (
          <EmptyState
            tone="danger"
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Could not load pharmacies."
            description="Please retry. Your session or permissions may need refreshing."
            action={
              <Button
                variant="danger"
                onClick={() => void pharmaciesQuery.refetch()}
              >
                Retry
              </Button>
            }
          />
        ) : null}

        {pharmaciesQuery.isSuccess && pharmaciesQuery.data.length === 0 ? (
          <EmptyState
            icon={<Store className="h-6 w-6" />}
            title="No pharmacies yet."
            description="Add a pharmacy and assign it to one of your organisation groups."
            action={
              canManagePharmacies ? (
                <Button
                  variant="primary"
                  leadingIcon={<Plus className="h-4 w-4" />}
                  onClick={openCreateModal}
                >
                  Create pharmacy
                </Button>
              ) : null
            }
          />
        ) : null}

        {pharmaciesQuery.isSuccess && pharmaciesQuery.data.length > 0 ? (
          <TableScroll>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Code</TH>
                  <TH>Group</TH>
                  <TH>Postcode</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {pharmaciesQuery.data.map((pharmacy) => (
                  <TR key={pharmacy.id}>
                    <TD className="whitespace-nowrap font-semibold text-ink">
                      {pharmacy.name}
                    </TD>
                    <TD className="whitespace-nowrap font-mono text-muted">
                      {pharmacy.code}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {groupIdToName.get(pharmacy.group) ?? "—"}
                    </TD>
                    <TD className="tnum whitespace-nowrap text-muted">
                      {pharmacy.postcode || "—"}
                    </TD>
                    <TD className="whitespace-nowrap">
                      <Badge
                        variant={pharmacy.is_active ? "success" : "neutral"}
                        dot
                      >
                        {pharmacy.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TD>
                    <TD className="tnum whitespace-nowrap text-muted">
                      {formatDate(pharmacy.created_at)}
                    </TD>
                    <TD className="whitespace-nowrap text-right">
                      {canManagePharmacies ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => openEditModal(pharmacy)}
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

      <PharmacyFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        pharmacy={editingPharmacy}
      />
    </Panel>
  );
}
