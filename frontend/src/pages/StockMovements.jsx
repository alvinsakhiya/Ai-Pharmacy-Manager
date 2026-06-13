import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardCheck,
  PackagePlus,
  RotateCw,
  Scale,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import MainLayout from "../layouts/MainLayout";
import PageHeader from "../components/Header";
import Badge from "../components/Badge";
import Button from "../components/Button";
import SearchField from "../components/SearchField";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import ListToolbar from "../components/ListToolbar";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";

const movementConfig = {
  RECEIVED: { icon: PackagePlus, tone: "success" },
  ADJUSTMENT: { icon: Scale, tone: "blue" },
  PICKING_ALLOCATION: { icon: ClipboardCheck, tone: "purple" },
  CORRECTION: { icon: Wrench, tone: "warning" },
  WASTE_QUARANTINE: { icon: ShieldAlert, tone: "danger" },
};

const movementOptions = [
  ["", "All movement types"],
  ["RECEIVED", "Received"],
  ["ADJUSTMENT", "Adjustment"],
  ["PICKING_ALLOCATION", "Picking allocation"],
  ["CORRECTION", "Correction"],
  ["WASTE_QUARANTINE", "Waste / quarantine"],
];

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function MovementBadge({ movement }) {
  const config = movementConfig[movement.movement_type] || {
    icon: ArrowLeftRight,
    tone: "slate",
  };

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {movement.movement_type_label}
    </Badge>
  );
}

function QuantityChange({ value }) {
  const isIncrease = value > 0;
  const Icon = isIncrease ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-black ${
        isIncrease ? "text-emerald-700" : "text-rose-700"
      }`}
    >
      <Icon aria-hidden="true" size={15} />
      {isIncrease ? "+" : ""}
      {value}
    </span>
  );
}

function StockMovements() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [movementType, setMovementType] = useState("");

  const movementPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: "50",
    });

    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (movementType) {
      params.set("movement_type", movementType);
    }

    return `/stock-movements/?${params.toString()}`;
  }, [movementType, page, searchQuery]);

  const {
    data,
    error,
    isLoading,
    isReloading,
    reload,
  } = useApiResource(
    movementPath,
    "Stock movement history could not be retrieved. Check the API connection and try again.",
    { count: 0, next: null, previous: null, results: [] }
  );

  const movements = data?.results || [];
  const totalMovements = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalMovements / 50));

  const changeFilter = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Stock governance"
        title="Stock movement history"
        description="Review the append-only quantity ledger for receipts, controlled adjustments, allocations, corrections and quarantined stock."
        icon={ArrowLeftRight}
        actions={
          <Button
            icon={RotateCw}
            loading={isReloading}
            variant="secondary"
            onClick={reload}
          >
            Refresh history
          </Button>
        }
      />

      <section
        className="clinical-grid mb-6 rounded-[1.5rem] border border-blue-200/70 bg-blue-50/55 p-5 sm:p-6"
        aria-labelledby="movement-integrity-heading"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-white/70 text-blue-800 shadow-sm">
            <ArrowLeftRight aria-hidden="true" size={21} />
          </div>
          <div>
            <h2
              id="movement-integrity-heading"
              className="text-base font-bold text-slate-950"
            >
              Immutable quantity trail
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Each entry captures the staff member, reason, signed quantity
              change, and the balance before and after. Picking lists remain
              recommendations and do not consume stock until an allocation is
              explicitly committed.
            </p>
          </div>
        </div>
      </section>

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!isLoading && !error ? movements.length : null}
          total={!isLoading && !error ? totalMovements : null}
          unit="movements on this page"
          filters={
            <>
              <label className="sr-only" htmlFor="movement-type-filter">
                Filter by movement type
              </label>
              <select
                id="movement-type-filter"
                className="field-control min-w-52 font-semibold"
                value={movementType}
                onChange={(event) =>
                  changeFilter(setMovementType)(event.target.value)
                }
              >
                {movementOptions.map(([value, label]) => (
                  <option key={value || "all"} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </>
          }
        >
          <SearchField
            id="movement-search"
            label="Search stock movements"
            placeholder="Search medicine, batch, reason or staff member..."
            value={searchQuery}
            onChange={changeFilter(setSearchQuery)}
          />
        </ListToolbar>

        {isLoading ? (
          <LoadingState label="Loading stock movement history..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No matching stock movements"
            message="Adjust the search or movement filter. New controlled stock changes will appear here automatically."
          />
        ) : (
          <>
            <TableShell
              className="hidden lg:block"
              label="Immutable stock movement history"
              minWidth="1180px"
            >
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Medication / batch</th>
                  <th>Movement</th>
                  <th>Change</th>
                  <th>Balance</th>
                  <th>Reason</th>
                  <th>Staff member</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap text-sm font-semibold text-slate-600">
                      {formatTimestamp(movement.timestamp)}
                    </td>
                    <td>
                      <p className="font-bold text-slate-900">
                        {movement.medication_name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-400">
                        Batch {movement.batch_number}
                      </p>
                    </td>
                    <td>
                      <MovementBadge movement={movement} />
                    </td>
                    <td>
                      <QuantityChange value={movement.quantity_change} />
                    </td>
                    <td className="whitespace-nowrap text-sm font-bold text-slate-700">
                      {movement.quantity_before}
                      <span className="sr-only"> to </span>
                      <span aria-hidden="true" className="px-2 text-slate-300">
                        →
                      </span>
                      {movement.quantity_after}
                    </td>
                    <td className="max-w-sm text-sm leading-6 text-slate-600">
                      {movement.reason}
                    </td>
                    <td className="font-bold text-slate-800">
                      {movement.actor_display}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>

            <div className="divide-y divide-slate-100 lg:hidden">
              {movements.map((movement) => (
                <article key={movement.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">
                        {movement.medication_name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-400">
                        Batch {movement.batch_number}
                      </p>
                    </div>
                    <MovementBadge movement={movement} />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {movement.reason}
                  </p>

                  <dl className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Change</dt>
                      <dd>
                        <QuantityChange value={movement.quantity_change} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Balance</dt>
                      <dd className="font-bold text-slate-700">
                        {movement.quantity_before}
                        <span className="sr-only"> to </span>
                        <span aria-hidden="true" className="px-1.5 text-slate-300">
                          →
                        </span>
                        {movement.quantity_after}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Staff</dt>
                      <dd className="text-right font-bold text-slate-800">
                        {movement.actor_display}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="font-semibold text-slate-400">Time</dt>
                      <dd className="text-right font-semibold text-slate-700">
                        {formatTimestamp(movement.timestamp)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <nav
              className="flex flex-col gap-3 border-t border-white/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              aria-label="Stock movement pagination"
            >
              <p className="text-sm font-semibold text-slate-500">
                Page {page} of {totalPages} · {totalMovements} total movements
              </p>
              <div className="flex gap-3">
                <Button
                  disabled={!data.previous}
                  variant="secondary"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={!data.next}
                  variant="secondary"
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default StockMovements;
