import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArchiveX,
  ChartSpline,
  CheckCircle2,
  CircleOff,
  PackageSearch,
  PencilLine,
  RefreshCw,
  Save,
  Scale,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import Badge from "../components/Badge";
import Button from "../components/Button";
import ClinicalMetric from "../components/ClinicalMetric";
import PageHeader from "../components/Header";
import ListToolbar from "../components/ListToolbar";
import { EmptyState, ErrorState, LoadingState } from "../components/PageState";
import { Panel, PanelHeader } from "../components/Panel";
import SearchField from "../components/SearchField";
import TableShell from "../components/TableShell";
import useApiResource from "../hooks/useApiResource";
import useToast from "../hooks/useToast";
import MainLayout from "../layouts/MainLayout";
import api from "../services/api";

const initialIntelligence = {
  summary: {
    total_medications: 0,
    low_stock: 0,
    excess_stock: 0,
    inactive_stock: 0,
    dead_stock: 0,
    no_active_demand: 0,
    adequate_stock: 0,
    recommended_order_units: 0,
  },
  items: [],
};

const groupOptions = [
  ["ALL", "All stock states"],
  ["LOW_STOCK", "Action: low stock"],
  ["EXCESS", "Review: excess stock"],
  ["INACTIVE", "Review: inactive stock"],
  ["DEAD_STOCK", "Review: dead stock"],
  ["ADEQUATE", "Ready: adequate stock"],
  ["NO_DEMAND", "No active demand"],
];

const statusConfig = {
  NO_DEMAND: { icon: CircleOff, tone: "slate" },
  INACTIVE: { icon: CircleOff, tone: "slate" },
  DEAD_STOCK: { icon: ArchiveX, tone: "warning" },
  OUT_OF_STOCK: { icon: ShieldAlert, tone: "danger" },
  CRITICAL_SHORTAGE: { icon: ShieldAlert, tone: "danger" },
  BELOW_MINIMUM: { icon: AlertTriangle, tone: "danger" },
  REORDER_THRESHOLD: { icon: TrendingDown, tone: "warning" },
  LOW_COVER: { icon: TrendingDown, tone: "warning" },
  BELOW_TARGET: { icon: TrendingDown, tone: "warning" },
  ADEQUATE: { icon: CheckCircle2, tone: "success" },
  EXCESS_STOCK: { icon: TrendingUp, tone: "blue" },
};

function readThresholdError(error) {
  const data = error.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data && typeof data === "object") {
    const firstMessage = Object.values(data).flat()[0];
    if (firstMessage) {
      return String(firstMessage);
    }
  }

  return "The stock controls could not be saved. Check the connection and try again.";
}

function StockStatusBadge({ item }) {
  const config = statusConfig[item.stock_status] || statusConfig.NO_DEMAND;

  return (
    <Badge icon={config.icon} tone={config.tone}>
      {item.stock_status_label}
    </Badge>
  );
}

function ThresholdEditor({ item, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    minimum_stock_level: String(item.minimum_stock_level),
    reorder_threshold: String(item.reorder_threshold),
    target_weeks_of_cover: String(item.target_weeks_of_cover),
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minimum = Number(form.minimum_stock_level);
  const threshold = Number(form.reorder_threshold);
  const targetWeeks = Number(form.target_weeks_of_cover);
  const isValid =
    Number.isInteger(minimum)
    && minimum >= 0
    && Number.isInteger(threshold)
    && threshold >= minimum
    && Number.isFinite(targetWeeks)
    && targetWeeks >= 1
    && targetWeeks <= 52;

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValid) {
      setError(
        "Use whole non-negative stock levels, keep the reorder threshold at or above the minimum, and choose 1 to 52 target weeks."
      );
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await api.patch(`/medications/${item.medication_id}/`, {
        minimum_stock_level: minimum,
        reorder_threshold: threshold,
        target_weeks_of_cover: targetWeeks,
      });
      toast.success(
        "Stock controls updated",
        `${item.medication} will be reassessed against the new thresholds.`
      );
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(readThresholdError(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Panel className="mb-6 overflow-hidden border-blue-200/70">
      <PanelHeader
        eyebrow="Medication stock policy"
        icon={Scale}
        title={`Configure ${item.medication}`}
        description="These controls make the recommendation explainable: the minimum is the safety floor, the reorder threshold triggers action, and target cover sets the replenishment aim."
        action={
          <button
            type="button"
            aria-label="Close stock controls"
            className="glass-icon-button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        }
      />

      <form
        className="grid gap-5 p-5 sm:p-6 lg:grid-cols-3"
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="minimum-stock">
            Minimum stock level
          </label>
          <input
            id="minimum-stock"
            type="number"
            min="0"
            step="1"
            required
            className="field-control mt-2"
            value={form.minimum_stock_level}
            onChange={updateField("minimum_stock_level")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Stock below this floor is classified as a high-risk shortage.
          </p>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="reorder-threshold">
            Reorder threshold
          </label>
          <input
            id="reorder-threshold"
            type="number"
            min="0"
            step="1"
            required
            className="field-control mt-2"
            value={form.reorder_threshold}
            onChange={updateField("reorder_threshold")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Must be at least the minimum level so action begins before the floor.
          </p>
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700" htmlFor="target-cover">
            Target weeks of cover
          </label>
          <input
            id="target-cover"
            type="number"
            min="1"
            max="52"
            step="0.5"
            required
            className="field-control mt-2"
            value={form.target_weeks_of_cover}
            onChange={updateField("target_weeks_of_cover")}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Converts active weekly dosette demand into a target stock quantity.
          </p>
        </div>

        {error && (
          <div
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 lg:col-span-3"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 lg:col-span-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            icon={Save}
            loading={isSubmitting}
            disabled={!isValid}
          >
            Save stock controls
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function StockIdentity({ item }) {
  return (
    <div className="min-w-0">
      <p className="font-bold text-slate-950">{item.medication}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">
        Target {item.target_stock} units · {item.target_weeks_of_cover} weeks
      </p>
    </div>
  );
}

function StockIntelligence() {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [selectedItem, setSelectedItem] = useState(null);
  const {
    data,
    error,
    isLoading,
    isReloading,
    reload,
  } = useApiResource(
    "/stock-intelligence/",
    "Stock intelligence could not be retrieved. Check the API connection and try again.",
    initialIntelligence
  );

  const items = Array.isArray(data.items) ? data.items : initialIntelligence.items;
  const summary = data.summary || initialIntelligence.summary;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesSearch = [
          item.medication,
          item.stock_status_label,
          item.recommendation,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));
        const matchesGroup =
          groupFilter === "ALL" || item.analytics_group === groupFilter;

        return matchesSearch && matchesGroup;
      }),
    [groupFilter, items, normalizedQuery]
  );

  return (
    <MainLayout>
      <PageHeader
        eyebrow="Stock decision support"
        title="Stock intelligence"
        description="Set explainable stock controls and identify shortages, excess holdings, inactive lines and dead-stock review candidates."
        icon={ChartSpline}
        actions={
          <Button
            icon={RefreshCw}
            variant="secondary"
            loading={isReloading}
            onClick={reload}
          >
            Refresh analysis
          </Button>
        }
      />

      {!isLoading && !error && (
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
          <ClinicalMetric
            description={`${summary.recommended_order_units} suggested units`}
            icon={ShieldAlert}
            label="Low stock"
            tone="critical"
            value={summary.low_stock}
          />
          <ClinicalMetric
            description="Review against active demand"
            icon={TrendingUp}
            label="Excess stock"
            tone="info"
            value={summary.excess_stock}
          />
          <ClinicalMetric
            description="No active dosette demand"
            icon={CircleOff}
            label="Inactive"
            tone="neutral"
            value={summary.inactive_stock}
          />
          <ClinicalMetric
            description="No demand for 180+ days"
            icon={ArchiveX}
            label="Dead stock"
            tone="attention"
            value={summary.dead_stock}
          />
          <ClinicalMetric
            description="Within configured controls"
            icon={CheckCircle2}
            label="Adequate"
            tone="ready"
            value={summary.adequate_stock}
          />
          <ClinicalMetric
            description="Medication catalogue"
            icon={PackageSearch}
            label="Analysed"
            tone="info"
            value={summary.total_medications}
          />
        </section>
      )}

      {selectedItem && (
        <ThresholdEditor
          key={selectedItem.medication_id}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={reload}
        />
      )}

      <Panel className="overflow-hidden">
        <ListToolbar
          shown={!isLoading && !error ? filteredItems.length : null}
          total={!isLoading && !error ? items.length : null}
          unit="medications shown"
          filters={
            <>
              <label className="sr-only" htmlFor="stock-group-filter">
                Filter stock intelligence
              </label>
              <select
                id="stock-group-filter"
                className="field-control w-full font-semibold lg:max-w-56"
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
              >
                {groupOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </>
          }
        >
          <SearchField
            id="stock-intelligence-search"
            label="Search stock intelligence"
            placeholder="Search medication, status or recommendation..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </ListToolbar>

        {isLoading ? (
          <LoadingState label="Calculating stock intelligence..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No matching stock analysis"
            message="Adjust the medication search or stock-state filter to review other lines."
          />
        ) : (
          <>
            <TableShell
              className="hidden lg:block"
              label="Medication stock intelligence and configured controls"
              minWidth="1260px"
            >
              <thead>
                <tr>
                  <th>Medication and target</th>
                  <th>Available / demand</th>
                  <th>Stock cover</th>
                  <th>Configured controls</th>
                  <th>Status</th>
                  <th>Recommendation</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.medication_id}>
                    <td>
                      <StockIdentity item={item} />
                    </td>
                    <td>
                      <p className="font-black text-slate-950">
                        {item.current_stock} units
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {item.predicted_weekly_demand} per week
                      </p>
                    </td>
                    <td>
                      <p className="font-black text-slate-950">
                        {item.weeks_of_cover == null
                          ? "No demand"
                          : `${item.weeks_of_cover} weeks`}
                      </p>
                      {item.excess_quantity > 0 && (
                        <p className="mt-1 text-xs font-bold text-blue-700">
                          {item.excess_quantity} above target
                        </p>
                      )}
                    </td>
                    <td>
                      <dl className="grid gap-1 text-xs">
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-400">Minimum</dt>
                          <dd className="font-bold text-slate-700">
                            {item.minimum_stock_level}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-400">Reorder</dt>
                          <dd className="font-bold text-slate-700">
                            {item.reorder_threshold}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-400">Target</dt>
                          <dd className="font-bold text-slate-700">
                            {item.target_weeks_of_cover} weeks
                          </dd>
                        </div>
                      </dl>
                    </td>
                    <td>
                      <StockStatusBadge item={item} />
                    </td>
                    <td className="max-w-xs">
                      <p className="text-sm font-semibold leading-6 text-slate-600">
                        {item.recommendation}
                      </p>
                      {item.recommended_order_quantity > 0 && (
                        <p className="mt-1 text-xs font-black text-rose-700">
                          Suggested order: {item.recommended_order_quantity} units
                        </p>
                      )}
                    </td>
                    <td>
                      <Button
                        icon={PencilLine}
                        variant="secondary"
                        onClick={() => setSelectedItem(item)}
                      >
                        Configure
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>

            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:hidden">
              {filteredItems.map((item) => (
                <article
                  key={item.medication_id}
                  className="rounded-2xl border border-white/80 bg-white/55 p-4 shadow-sm backdrop-blur-xl"
                >
                  <div className="flex flex-col items-start gap-3">
                    <StockIdentity item={item} />
                    <StockStatusBadge item={item} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50/80 p-3">
                      <dt className="text-xs font-semibold text-slate-400">
                        Available
                      </dt>
                      <dd className="mt-1 text-lg font-black text-slate-950">
                        {item.current_stock}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 p-3">
                      <dt className="text-xs font-semibold text-slate-400">
                        Weekly demand
                      </dt>
                      <dd className="mt-1 text-lg font-black text-slate-950">
                        {item.predicted_weekly_demand}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 p-3">
                      <dt className="text-xs font-semibold text-slate-400">
                        Stock cover
                      </dt>
                      <dd className="mt-1 font-black text-slate-950">
                        {item.weeks_of_cover == null
                          ? "No demand"
                          : `${item.weeks_of_cover} weeks`}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-50/80 p-3">
                      <dt className="text-xs font-semibold text-slate-400">
                        Reorder suggestion
                      </dt>
                      <dd className="mt-1 font-black text-slate-950">
                        {item.recommended_order_quantity} units
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
                    {item.recommendation}
                  </p>
                  <Button
                    className="mt-4 w-full"
                    icon={PencilLine}
                    variant="secondary"
                    onClick={() => setSelectedItem(item)}
                  >
                    Configure stock controls
                  </Button>
                </article>
              ))}
            </div>
          </>
        )}
      </Panel>
    </MainLayout>
  );
}

export default StockIntelligence;
