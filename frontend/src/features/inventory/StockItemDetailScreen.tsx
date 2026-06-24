import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  PackagePlus,
} from "lucide-react";

import { usePermissions } from "../../auth/usePermissions";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
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
import { AdjustBatchModal } from "./AdjustBatchModal";
import { CountBatchModal } from "./CountBatchModal";
import { ReceiveStockModal } from "./ReceiveStockModal";
import { TransferBatchModal } from "./TransferBatchModal";
import type { StockBatch } from "./inventoryApi";
import { useStockItemQuery } from "./useInventory";
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

function DetailValue({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className={cn("mt-1 text-sm font-bold text-ink", valueClassName)}>
        {value}
      </dd>
    </div>
  );
}

function BatchRow({
  batch,
  canManage,
  canTransfer,
  onAdjust,
  onCount,
  onTransfer,
}: {
  batch: StockBatch;
  canManage: boolean;
  canTransfer: boolean;
  onAdjust: (batch: StockBatch) => void;
  onCount: (batch: StockBatch) => void;
  onTransfer: (batch: StockBatch) => void;
}) {
  return (
    <TR>
      <TD className="font-semibold text-ink">{batch.batch_number}</TD>
      <TD className={cn("tnum font-medium", fefoToneClass(batch.expiry_date))}>
        {formatDate(batch.expiry_date)}
      </TD>
      <TD className="tnum">{batch.quantity}</TD>
      <TD className="tnum">{batch.quantity_received}</TD>
      <TD className="tnum">{formatDate(batch.received_at)}</TD>
      <TD>
        <StatusBadge active={batch.is_active} />
      </TD>
      {canManage || canTransfer ? (
        <TD className="text-right">
          <div className="flex justify-end gap-2">
            {canManage ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => onAdjust(batch)}>
                  Adjust
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onCount(batch)}>
                  Count
                </Button>
              </>
            ) : null}
            {canTransfer ? (
              <Button size="sm" variant="secondary" onClick={() => onTransfer(batch)}>
                Transfer
              </Button>
            ) : null}
          </div>
        </TD>
      ) : null}
    </TR>
  );
}

export function StockItemDetailScreen() {
  const { can } = usePermissions();
  const { stockItemId } = useParams();
  const parsedStockItemId = Number(stockItemId);
  const isValidStockItemId = Number.isFinite(parsedStockItemId);
  const stockItemQuery = useStockItemQuery(parsedStockItemId);
  const { pharmacyName } = usePharmacyNames();
  const canManage = can("stock.manage");
  const canTransfer = can("stock.transfer");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<{
    type: "adjust" | "count" | "transfer";
    batch: StockBatch;
  } | null>(null);

  if (!isValidStockItemId) {
    return (
      <EmptyState
        tone="danger"
        icon={<AlertTriangle className="h-6 w-6" />}
        title="This stock item was not found or is outside your access."
        action={
          <Link to="/inventory">
            <Button variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to inventory
            </Button>
          </Link>
        }
      />
    );
  }

  if (stockItemQuery.isLoading) {
    return (
      <div className="space-y-5">
        <span className="sr-only">Loading stock...</span>
        <Panel>
          <PanelBody className="space-y-4">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </PanelBody>
        </Panel>
      </div>
    );
  }

  if (stockItemQuery.isError || !stockItemQuery.data) {
    return (
      <EmptyState
        tone="danger"
        icon={<AlertTriangle className="h-6 w-6" />}
        title="This stock item was not found or is outside your access."
        description="Please return to the inventory list or retry after refreshing your session."
        action={
          <Link to="/inventory">
            <Button variant="secondary" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to inventory
            </Button>
          </Link>
        }
      />
    );
  }

  const stockItem = stockItemQuery.data;

  return (
    <div className="stagger space-y-5">
      <Link
        className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-brand transition-colors duration-150 ease-soft hover:text-brand-hover focus-ring"
        to="/inventory"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to inventory
      </Link>

      <PageHeader
        className="animate-fade-in-up"
        eyebrow={pharmacyName(stockItem.pharmacy)}
        title={stockItem.medication_name}
        actions={
          <>
            <StatusBadge active={stockItem.is_active} />
            {canManage ? (
              <Button
                variant="primary"
                leadingIcon={<PackagePlus className="h-4 w-4" />}
                onClick={() => setReceiveOpen(true)}
              >
                Receive stock
              </Button>
            ) : null}
          </>
        }
      />

      <Panel>
        <PanelBody>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailValue
              label="On hand"
              value={stockItem.quantity_on_hand}
              valueClassName="tnum"
            />
            <DetailValue
              label="Earliest expiry"
              value={formatDate(stockItem.earliest_expiry)}
              valueClassName={cn("tnum", fefoToneClass(stockItem.earliest_expiry))}
            />
            <DetailValue
              label="Reorder level"
              value={stockItem.reorder_level}
              valueClassName="tnum"
            />
            <DetailValue
              label="Unit price"
              value={stockItem.unit_price ? `£${stockItem.unit_price}` : "—"}
              valueClassName="tnum"
            />
            <DetailValue
              label="Box price"
              value={stockItem.pack_price ? `£${stockItem.pack_price}` : "—"}
              valueClassName="tnum"
            />
            <DetailValue
              label="Stock value"
              value={stockItem.stock_value ? `£${stockItem.stock_value}` : "—"}
              valueClassName="tnum font-bold text-ink"
            />
            <DetailValue
              label="Pharmacy"
              value={pharmacyName(stockItem.pharmacy)}
            />
          </dl>
        </PanelBody>
      </Panel>

      {stockItem.batches.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title="No batches recorded for this stock item."
          description="Batches appear here once stock is received against this item."
        />
      ) : (
        <Panel>
          <PanelHeader title="Batches" />
          <TableScroll className="rounded-none border-0 shadow-none">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Batch number</TH>
                  <TH>Expiry date</TH>
                  <TH>Quantity</TH>
                  <TH>Quantity received</TH>
                  <TH>Received at</TH>
                  <TH>Status</TH>
                  {canManage || canTransfer ? (
                    <TH className="text-right">Actions</TH>
                  ) : null}
                </TR>
              </THead>
              <TBody>
                {stockItem.batches.map((batch) => (
                  <BatchRow
                    batch={batch}
                    canManage={canManage}
                    canTransfer={canTransfer}
                    key={batch.id}
                    onAdjust={(nextBatch) =>
                      setBatchAction({ type: "adjust", batch: nextBatch })
                    }
                    onCount={(nextBatch) =>
                      setBatchAction({ type: "count", batch: nextBatch })
                    }
                    onTransfer={(nextBatch) =>
                      setBatchAction({ type: "transfer", batch: nextBatch })
                    }
                  />
                ))}
              </TBody>
            </Table>
          </TableScroll>
        </Panel>
      )}

      <ReceiveStockModal
        isOpen={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        stockItem={stockItem}
      />
      {batchAction?.type === "adjust" ? (
        <AdjustBatchModal
          batch={batchAction.batch}
          isOpen
          onClose={() => setBatchAction(null)}
        />
      ) : null}
      {batchAction?.type === "count" ? (
        <CountBatchModal
          batch={batchAction.batch}
          isOpen
          onClose={() => setBatchAction(null)}
        />
      ) : null}
      {batchAction?.type === "transfer" ? (
        <TransferBatchModal
          batch={batchAction.batch}
          isOpen
          onClose={() => setBatchAction(null)}
          sourcePharmacyId={stockItem.pharmacy}
        />
      ) : null}
    </div>
  );
}
