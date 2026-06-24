import { useState } from "react";

import { AlertTriangle, Info, Pill, Plus } from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import {
  Table,
  TableScroll,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "../../components/ui/Table";
import { SkeletonRows } from "../../components/ui/Skeleton";
import {
  formLabel,
  type Medication,
} from "./catalogueApi";
import { MedicationFormModal } from "./MedicationFormModal";
import { useMedicationsQuery } from "./useCatalogue";

function packLabel(medication: Medication): string {
  if (medication.catalogue_product_pack_size == null) {
    return "—";
  }
  return `${medication.catalogue_product_pack_size}${
    medication.catalogue_product_pack_unit
      ? ` ${medication.catalogue_product_pack_unit}`
      : ""
  }`;
}

export function MedicationsScreen() {
  const { can } = usePermissions();
  const canManage = can("medication.manage");
  const medicationsQuery = useMedicationsQuery();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(
    null,
  );

  function openCreateModal() {
    setEditingMedication(null);
    setModalOpen(true);
  }

  function openEditModal(medication: Medication) {
    setEditingMedication(medication);
    setModalOpen(true);
  }

  const medications = medicationsQuery.data ?? [];
  const hasLegacyMedications = medications.some(
    (medication) => medication.catalogue_product === null,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="Catalogue / local library"
        title="Medication Library"
        subtitle="Search and enable catalogue products used for stock, MDS/Dosette, and reports."
        actions={
          canManage ? (
            <Button
              variant="primary"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={openCreateModal}
            >
              Add from catalogue
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-subtle p-4 text-sm text-ink-soft shadow-soft">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p>
          This library shows catalogue products that are enabled for this
          pharmacy/group. Stock intake and MDS/Dosette workflows use this same
          catalogue, so staff do not need to type medicine names manually.
        </p>
      </div>

      {medicationsQuery.isLoading ? (
        <div
          aria-busy="true"
          className="rounded-2xl border border-line bg-surface p-5 shadow-soft"
        >
          <span className="sr-only">Loading medications...</span>
          <SkeletonRows rows={5} />
        </div>
      ) : null}

      {medicationsQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Could not load medications."
          description="Please retry. Your session or permissions may need refreshing."
          action={
            <Button
              variant="danger"
              onClick={() => void medicationsQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {medicationsQuery.isSuccess && medications.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-6 w-6" />}
          title="No catalogue products enabled yet."
          description="Add the first catalogue product to make it available across your permitted pharmacies."
          action={
            canManage ? (
              <Button
                variant="primary"
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={openCreateModal}
              >
                Add from catalogue
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {medicationsQuery.isSuccess && hasLegacyMedications ? (
        <div className="rounded-2xl border border-warning-border bg-warning-soft p-4 text-sm font-medium text-warning-ink">
          Legacy records were created before catalogue selection and should be
          reviewed.
        </div>
      ) : null}

      {medicationsQuery.isSuccess && medications.length > 0 ? (
        <TableScroll>
          <Table>
            <THead>
              <TR>
                <TH>Catalogue product</TH>
                <TH>Form</TH>
                <TH>Pack</TH>
                <TH>Manufacturer</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {medications.map((medication) => (
                <TR key={medication.id}>
                  <TD className="font-semibold text-ink">
                    <div className="flex items-center gap-2">
                      <span>
                        {medication.catalogue_product_full_label ??
                          medication.name}
                      </span>
                      {medication.catalogue_product === null ? (
                        <Badge variant="warning">Legacy</Badge>
                      ) : null}
                    </div>
                  </TD>
                  <TD>{formLabel(medication.form)}</TD>
                  <TD className="tnum">{packLabel(medication)}</TD>
                  <TD>{medication.manufacturer || "—"}</TD>
                  <TD>
                    {medication.is_active ? (
                      <Badge variant="success" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="neutral" dot>
                        Inactive
                      </Badge>
                    )}
                  </TD>
                  <TD className="text-right">
                    {canManage ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(medication)}
                      >
                        Local settings
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      ) : null}

      <MedicationFormModal
        isOpen={isModalOpen}
        medication={editingMedication}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
