/** Smart Reorder + Waste AI — forecast-driven ordering and FEFO waste projection. */
import { useEffect, useState } from "react";
import { PackageSearch, TimerReset, Check, Loader2, TrendingDown, Plus } from "lucide-react";
import { Card, Button, StatusChip, EmptyState, TableSkeleton, useToast, cx } from "../../components/ui";
import { reorder } from "../../services/aiClient";

const URGENCY = {
  now: { tone: "danger", label: "Order now" },
  soon: { tone: "warning", label: "Order soon" },
  ok: { tone: "success", label: "Healthy" },
};

export default function SmartReorder() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drafted, setDrafted] = useState({});

  const load = () => {
    setLoading(true);
    reorder().then((d) => {
      setData(d);
      setLoading(false);
    });
  };
  useEffect(load, []);

  const draft = (key, qty, medicine) => {
    setDrafted((d) => ({ ...d, [key]: true }));
    toast?.success(`Drafted order: ${medicine} ×${qty}`);
  };
  const draftAll = () => {
    const next = {};
    suggestions.forEach((i) => (next[i.medicine] = true));
    setDrafted((d) => ({ ...d, ...next }));
    toast?.success(`Drafted ${suggestions.length} orders`);
  };

  const suggestions = (data?.items || []).filter((i) => i.urgency !== "ok");
  const healthy = (data?.items || []).filter((i) => i.urgency === "ok");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display font-semibold tracking-tight">Smart Reorder + Waste</h1>
          <p className="mt-1 text-body text-text-secondary">
            Reorder quantities from run-rate and lead time; waste projected from FEFO expiry. Review, then draft to an order.
          </p>
        </div>
        {data && (
          <Button onClick={draftAll} disabled={!suggestions.length}>
            <Plus size={16} /> Draft all ({suggestions.length})
          </Button>
        )}
      </header>

      {/* Summary tiles */}
      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Lines to order", value: data.summary.toOrder, tone: data.summary.toOrder ? "text-danger-fg" : "text-text-primary" },
            { label: "Units suggested", value: data.summary.orderUnits, tone: "text-text-primary" },
            { label: "Waste units (90d)", value: data.summary.wasteUnits, tone: data.summary.wasteUnits ? "text-warning-fg" : "text-text-primary" },
            { label: "Waste value", value: `£${data.summary.wasteValue}`, tone: "text-text-primary" },
          ].map((t) => (
            <Card key={t.label} className="p-4">
              <div className="text-caption font-medium text-text-secondary">{t.label}</div>
              <div className={cx("mt-1 text-display font-semibold tnum", t.tone)}>{t.value}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Reorder table */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
          <PackageSearch size={16} className="text-accent" />
          <h3 className="text-subtitle font-semibold">Reorder suggestions</h3>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : suggestions.length === 0 ? (
          <EmptyState icon={Check} title="Nothing to order" hint="All lines have healthy cover above their reorder level." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead className="sticky top-0 bg-app/70 text-left text-caption text-text-secondary backdrop-blur">
                <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-medium">
                  <th>Medicine</th>
                  <th className="text-right">On hand</th>
                  <th className="text-right">Cover</th>
                  <th className="text-right">Suggest</th>
                  <th>Supplier</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {suggestions.map((i) => {
                  const u = URGENCY[i.urgency];
                  const done = drafted[i.medicine];
                  return (
                    <tr key={i.medicine} className="transition-colors hover:bg-subtle">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{i.medicine}</div>
                        <div className="mt-0.5 text-caption text-text-tertiary">{i.rationale}</div>
                      </td>
                      <td className="px-4 py-3 text-right tnum">{i.onHand}</td>
                      <td className="px-4 py-3 text-right tnum">{i.weeksCover}w</td>
                      <td className="px-4 py-3 text-right tnum font-semibold text-text-primary">+{i.suggestedQty}</td>
                      <td className="px-4 py-3">
                        <div className="text-text-secondary">{i.supplier}</div>
                        <div className="text-caption text-text-tertiary">{i.leadTimeDays}d lead</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <StatusChip tone={u.tone} icon={false} dot>
                            {u.label}
                          </StatusChip>
                          <Button
                            variant={done ? "secondary" : "primary"}
                            size="sm"
                            disabled={done}
                            onClick={() => draft(i.medicine, i.suggestedQty, i.medicine)}
                          >
                            {done ? (
                              <>
                                <Check size={14} /> Drafted
                              </>
                            ) : (
                              "Draft"
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && healthy.length > 0 && (
          <div className="border-t border-border-subtle px-4 py-2.5 text-caption text-text-tertiary">
            + {healthy.length} more lines with healthy cover (hidden)
          </div>
        )}
      </Card>

      {/* Waste projection */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
          <TimerReset size={16} className="text-warning-fg" />
          <h3 className="text-subtitle font-semibold">Waste projection (FEFO)</h3>
        </div>
        {loading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : !data?.waste?.length ? (
          <EmptyState icon={TrendingDown} title="No waste projected" hint="Stock is expected to be used before expiry." />
        ) : (
          <div className="divide-y divide-border-subtle">
            {data.waste.map((w) => (
              <div key={w.batch} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-text-primary">{w.medicine}</div>
                  <div className="text-caption text-text-tertiary tnum">
                    Batch {w.batch} · expires {w.expiry} · {w.daysToExpiry}d
                  </div>
                </div>
                <StatusChip tone={w.daysToExpiry <= 14 ? "danger" : "warning"}>
                  {w.projectedWaste} at risk · £{w.value}
                </StatusChip>
                <p className="w-full text-caption text-text-secondary sm:w-auto sm:flex-1 sm:text-right">{w.suggestion}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-caption text-text-tertiary">
        Forecast-based estimates for decision-support; confirm quantities before ordering.
      </p>
    </div>
  );
}
