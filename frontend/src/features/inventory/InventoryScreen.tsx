import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  Layers,
  PackageCheck,
  PlusCircle,
  Search,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
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
import { cn } from "../../lib/cn";
import { scopeLabel } from "../../lib/scope";
import { inputClass, labelClass, selectClass } from "../../components/ui/forms";
import { formatNumber } from "./stockIntakeForm";
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

function formatDateLong(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

function daysUntil(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(value);
  expiry.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  return Math.round(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function filterLabel(searchTerm: string, selectedPharmacyId?: number): string {
  const active = [searchTerm.trim().length > 0, selectedPharmacyId !== undefined]
    .filter(Boolean)
    .length;

  return active === 0
    ? "All stock"
    : `${active} active filter${active === 1 ? "" : "s"}`;
}

function stockValueSummary(items: StockItem[]) {
  const values = items
    .map((item) => Number(item.stock_value))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return { count: 0, total: null };
  }

  return {
    count: values.length,
    total: values.reduce((total, value) => total + value, 0),
  };
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

function StockRiskBadge({ item }: { item: StockItem }) {
  if (!item.is_active) {
    return <Badge variant="neutral">Inactive item</Badge>;
  }

  const isAtReviewLevel = item.quantity_on_hand <= item.reorder_level;

  return (
    <Badge variant={isAtReviewLevel ? "warning" : "success"} dot>
      {isAtReviewLevel ? "Stock risk" : "In range"}
    </Badge>
  );
}

function ExpiryBadge({ value }: { value: string | null }) {
  const days = daysUntil(value);

  if (days === null) {
    return <Badge variant="neutral">No dated batch</Badge>;
  }
  if (days <= 0) {
    return <Badge variant="danger">Expired</Badge>;
  }
  if (days <= 90) {
    return <Badge variant="warning">Expiry review</Badge>;
  }

  return <Badge variant="success">Dated batch</Badge>;
}

function earliestItem(items: StockItem[]): StockItem | undefined {
  return items
    .filter((item) => item.earliest_expiry !== null)
    .sort((a, b) =>
      String(a.earliest_expiry).localeCompare(String(b.earliest_expiry)),
    )[0];
}

function InventoryMetric({
  icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClass = {
    neutral: "border-line bg-surface text-brand",
    warning: "border-warning-border bg-warning-soft text-warning-ink",
    success: "border-success-border bg-success-soft text-success-ink",
  }[tone];

  return (
    <Panel className="shadow-elev-1">
      <PanelBody className="flex min-h-[128px] items-start gap-3 p-4">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
            toneClass,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.06em] text-muted">
            {label}
          </p>
          <p className="tnum mt-1 text-xl font-extrabold tracking-[-0.02em] text-ink">
            {value}
          </p>
          <p className="mt-0.5 text-xs font-medium leading-snug text-muted">
            {detail}
          </p>
        </div>
      </PanelBody>
    </Panel>
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
      <TD>
        <div className="min-w-[16rem]">
          <p className="font-semibold text-ink">{item.medication_name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="neutral">Stock item #{item.id}</Badge>
            <StockRiskBadge item={item} />
          </div>
        </div>
      </TD>
      <TD>
        <p className="font-medium text-ink-soft">{pharmacyName(item.pharmacy)}</p>
        <p className="mt-1 text-xs text-muted">Medication #{item.medication}</p>
      </TD>
      <TD>
        <p className="tnum text-base font-extrabold text-ink">
          {formatNumber(item.quantity_on_hand)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Reorder level {formatNumber(item.reorder_level)}
        </p>
      </TD>
      <TD>
        <div className="space-y-2">
          <p className={cn("tnum font-semibold", fefoToneClass(item.earliest_expiry))}>
            {formatDate(item.earliest_expiry)}
          </p>
          <ExpiryBadge value={item.earliest_expiry} />
        </div>
      </TD>
      <TD className="tnum font-semibold text-ink">
        {item.stock_value ? `£${item.stock_value}` : "Not set"}
      </TD>
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
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [addStockOpen, setAddStockOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const dateLabel = useMemo(() => formatDateLong(today), [today]);
  const stockItemsQuery = useStockItemsQuery(
    selectedPharmacyId,
    debouncedSearchTerm,
  );
  const { pharmacyName } = usePharmacyNames();
  const stockItems = stockItemsQuery.data ?? [];
  const selectedPharmacy = pharmacies.find(
    (pharmacy) => pharmacy.id === selectedPharmacyId,
  );
  const totalUnits = stockItems.reduce(
    (total, item) => total + item.quantity_on_hand,
    0,
  );
  const activeCount = stockItems.filter((item) => item.is_active).length;
  const reorderReviewCount = stockItems.filter(
    (item) => item.quantity_on_hand <= item.reorder_level,
  ).length;
  const expiryReviewCount = stockItems.filter((item) => {
    const days = daysUntil(item.earliest_expiry);
    return days !== null && days <= 90;
  }).length;
  const soonestItem = earliestItem(stockItems);
  const stockValue = stockValueSummary(stockItems);
  const activeFilterLabel = filterLabel(searchTerm, selectedPharmacyId);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="stagger space-y-5">
      <header className="animate-fade-in-up space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Stock workspace
            </p>
            <h1 className="mt-1.5 text-[30px] font-extrabold tracking-[-0.025em] text-ink sm:text-[34px]">
              Inventory
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Review stock levels, batches, and expiry risk before action.
            </p>
          </div>
          {canReceiveStock ? (
            <Button
              variant="primary"
              leadingIcon={<PlusCircle className="h-4 w-4" />}
              onClick={() => setAddStockOpen(true)}
            >
              Add Stock
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            {user ? scopeLabel(user) : "Scope unavailable"}
          </Badge>
          <Badge variant="info">Human review required</Badge>
          <Badge variant="neutral">{activeFilterLabel}</Badge>
          {selectedPharmacy ? (
            <Badge variant="brand">{selectedPharmacy.name}</Badge>
          ) : null}
          <Badge variant="neutral">{dateLabel}</Badge>
          <Badge variant="brand">
            {stockItemsQuery.isSuccess
              ? `${formatNumber(stockItems.length)} records shown`
              : "Inventory loading"}
          </Badge>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <InventoryMetric
          icon={<Boxes className="h-5 w-5" />}
          label="Stock records"
          value={formatNumber(stockItems.length)}
          detail={`${formatNumber(activeCount)} active in current view`}
        />
        <InventoryMetric
          icon={<Layers className="h-5 w-5" />}
          label="Units on hand"
          value={formatNumber(totalUnits)}
          detail="Across visible stock records"
          tone="success"
        />
        <InventoryMetric
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Stock risk"
          value={formatNumber(reorderReviewCount)}
          detail="At or below reorder level"
          tone={reorderReviewCount > 0 ? "warning" : "neutral"}
        />
        <InventoryMetric
          icon={<CalendarClock className="h-5 w-5" />}
          label="Expiry review"
          value={formatNumber(expiryReviewCount)}
          detail={
            soonestItem
              ? `Earliest ${formatDate(soonestItem.earliest_expiry)}`
              : "No dated batches visible"
          }
          tone={expiryReviewCount > 0 ? "warning" : "neutral"}
        />
        <InventoryMetric
          icon={<PackageCheck className="h-5 w-5" />}
          label="Stock value"
          value={stockValue.total === null ? "—" : formatCurrency(stockValue.total)}
          detail={
            stockValue.count > 0
              ? `${formatNumber(stockValue.count)} priced records`
              : "No stock value in current view"
          }
          tone={stockValue.total && stockValue.total > 0 ? "success" : "neutral"}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Stock controls"
          subtitle={`${formatNumber(stockItems.length)} records shown from existing inventory data`}
        />
        <PanelBody>
          <div className="flex flex-wrap items-end gap-3">
            <label
              className={cn(labelClass, "min-w-72 flex-1")}
              htmlFor="inventory-search"
            >
              Search
              <span className="relative mt-1.5 block">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="inventory-search"
                  className={cn(inputClass, "mt-0 pl-9")}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search stock by medicine, strength, batch, or pharmacy…"
                  type="search"
                  value={searchTerm}
                />
              </span>
            </label>

            {pharmacies.length > 1 ? (
              <label
                className={cn(labelClass, "min-w-56")}
                htmlFor="inventory-pharmacy-filter"
              >
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
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            <Badge variant="info">{activeFilterLabel}</Badge>
            <span>Review before action</span>
          </div>
        </PanelBody>
      </Panel>

      {stockItemsQuery.isLoading ? (
        <Panel>
          <PanelHeader title="Inventory" subtitle="Loading inventory…" />
          <PanelBody>
            <span className="sr-only" role="status">
              Loading inventory…
            </span>
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
          title="No stock items match the current view."
          description="Adjust search or pharmacy filters, or add stock when appropriate."
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
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">
                Stock records
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Existing records only. Open a record for batch-level actions.
              </p>
            </div>
            <Badge variant="neutral">{formatNumber(stockItems.length)} shown</Badge>
          </div>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Medication</TH>
                <TH>Pharmacy</TH>
                <TH>On hand</TH>
                <TH>Expiry review</TH>
                <TH>Stock value</TH>
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
