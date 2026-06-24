import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, PlusCircle } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
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
import { cn } from "../../lib/cn";
import { labelClass, selectClass } from "../../components/ui/forms";
import { AddStockModal } from "./AddStockModal";
import type { StockItem } from "./inventoryApi";
import { useStockItemsQuery } from "./useInventory";
import { usePharmacyNames } from "./usePharmacyNames";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * FEFO expiry heat scale — colour the earliest-expiry date by days-to-expiry,
 * always paired with the date text itself (never colour alone).
 */
function fefoToneClass(value: string | null): string {
  if (!value) {
    return "text-muted";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(value);
  const days = Math.round(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (days <= 0) {
    return "text-fefo-expired";
  }
  if (days <= 30) {
    return "text-fefo-d30";
  }
  if (days <= 90) {
    return "text-fefo-d90";
  }
  if (days <= 180) {
    return "text-fefo-d180";
  }
  return "text-fefo-fresh";
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "neutral"} dot>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function StockRow({
  item,
  pharmacyName,
}: {
  item: StockItem;
  pharmacyName: (id: number) => string;
}) {
  return (
    <TR>
      <TD className="font-semibold text-ink">{item.medication_name}</TD>
      <TD>{pharmacyName(item.pharmacy)}</TD>
      <TD className="tnum">{item.quantity_on_hand}</TD>
      <TD className={cn("tnum font-medium", fefoToneClass(item.earliest_expiry))}>
        {formatDate(item.earliest_expiry)}
      </TD>
      <TD className="tnum">{item.reorder_level}</TD>
      <TD>
        <StatusBadge active={item.is_active} />
      </TD>
      <TD className="text-right">
        <Link
          className="inline-flex h-8 items-center rounded-full border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink-soft shadow-elev-1 transition-colors duration-150 ease-soft hover:bg-surface-subtle hover:text-ink focus-ring active:scale-[0.97]"
          to={`/inventory/${item.id}`}
        >
          View
        </Link>
      </TD>
    </TR>
  );
}

export function InventoryScreen() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const pharmacies = user?.pharmacies ?? [];
  const canReceiveStock = can("stock.receive");
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<
    number | undefined
  >(undefined);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const stockItemsQuery = useStockItemsQuery(selectedPharmacyId);
  const { pharmacyName } = usePharmacyNames();

  return (
    <div className="stagger space-y-5">
      <PageHeader
        className="animate-fade-in-up"
        eyebrow="Stock overview"
        title="Inventory"
        subtitle="Review pharmacy stock levels, earliest expiry dates, and batch status across the pharmacies in your permitted scope."
        actions={
          canReceiveStock ? (
            <Button
              variant="primary"
              leadingIcon={<PlusCircle className="h-4 w-4" />}
              onClick={() => setAddStockOpen(true)}
            >
              Add Stock
            </Button>
          ) : null
        }
      />

      {pharmacies.length > 1 ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className={cn(labelClass, "min-w-56")} htmlFor="inventory-pharmacy-filter">
            Pharmacy
            <select
              id="inventory-pharmacy-filter"
              className={selectClass}
              onChange={(event) =>
                setSelectedPharmacyId(
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
              value={selectedPharmacyId ?? ""}
            >
              <option value="">All pharmacies</option>
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>
                  {pharmacy.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {stockItemsQuery.isLoading ? (
        <Panel>
          <PanelBody>
            <span className="sr-only">Loading stock...</span>
            <SkeletonRows rows={6} />
          </PanelBody>
        </Panel>
      ) : null}

      {stockItemsQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Could not load inventory."
          description="Please retry. Your session or permissions may need refreshing."
          action={
            <Button
              variant="danger"
              onClick={() => void stockItemsQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {stockItemsQuery.isSuccess && stockItemsQuery.data.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title="No stock items yet."
          description="Stock items appear here once they are received into a pharmacy in your scope."
          action={
            canReceiveStock ? (
              <Button
                variant="primary"
                leadingIcon={<PlusCircle className="h-4 w-4" />}
                onClick={() => setAddStockOpen(true)}
              >
                Add Stock
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {stockItemsQuery.isSuccess && stockItemsQuery.data.length > 0 ? (
        <TableScroll>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Medication</TH>
                <TH>Pharmacy</TH>
                <TH>On hand</TH>
                <TH>Earliest expiry</TH>
                <TH>Reorder level</TH>
                <TH>Status</TH>
                <TH className="text-right">View</TH>
              </TR>
            </THead>
            <TBody>
              {stockItemsQuery.data.map((item) => (
                <StockRow
                  item={item}
                  key={item.id}
                  pharmacyName={pharmacyName}
                />
              ))}
            </TBody>
          </Table>
        </TableScroll>
      ) : null}

      <AddStockModal
        defaultPharmacyId={selectedPharmacyId}
        isOpen={addStockOpen}
        onClose={() => setAddStockOpen(false)}
      />
    </div>
  );
}
