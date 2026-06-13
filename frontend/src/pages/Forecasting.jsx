import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Brain, Lightbulb, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { Card, Select, Skeleton, StatusChip } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { num } from "../lib/format";

const METHOD_LABEL = {
  moving_average: "Moving average",
  holt_linear_trend: "Holt linear trend",
  holt_winters: "Holt-Winters (seasonal)",
  linear_trend: "Linear trend",
  none: "—",
};

export default function Forecasting() {
  const meds = useFetch("/medicines/", { params: { page_size: 500 } });
  const [medId, setMedId] = useState(null);
  const [horizon, setHorizon] = useState(4);
  const shortages = useFetch("/forecast/shortages/");

  useEffect(() => {
    if (!medId && meds.data?.results?.length) setMedId(meds.data.results[0].id);
  }, [meds.data, medId]);

  const fc = useFetch(`/forecast/medicine/${medId}/`, {
    params: { horizon },
    skip: !medId,
  });

  const chartData = useMemo(() => {
    if (!fc.data) return [];
    const hist = (fc.data.history || []).slice(-20).map((h) => ({
      label: h.week_start.slice(5),
      actual: h.quantity,
    }));
    const fore = (fc.data.forecast || []).map((f) => ({
      label: f.week_start.slice(5),
      mean: f.mean,
      band: [f.lower, f.upper],
    }));
    // join: last actual also seeds the forecast line for continuity
    if (hist.length && fore.length) {
      hist[hist.length - 1].mean = hist[hist.length - 1].actual;
    }
    return [...hist, ...fore];
  }, [fc.data]);

  const r = fc.data?.reorder;

  return (
    <>
      <PageHeader
        title="Forecasting"
        subtitle="Explainable demand forecasting & reorder recommendations"
        actions={
          <div className="flex items-center gap-2">
            <Select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="w-36">
              {[2, 4, 6, 8, 12].map((h) => (
                <option key={h} value={h}>{h}-week horizon</option>
              ))}
            </Select>
            <Select value={medId || ""} onChange={(e) => setMedId(Number(e.target.value))} className="w-60">
              {(meds.data?.results || []).map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-subtitle font-semibold">{fc.data?.medicine_label || "Forecast"}</h3>
            {fc.data && (
              <StatusChip tone="info" icon={false}>
                {METHOD_LABEL[fc.data.method]} · 95% CI
              </StatusChip>
            )}
          </div>
          {fc.loading || !fc.data ? (
            <Skeleton className="h-72" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ left: -12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9099A4" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9099A4" }} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6E8EC", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area name="95% confidence" dataKey="band" stroke="none" fill="#A5B4FC" fillOpacity={0.35} />
                <Line name="Actual usage" type="monotone" dataKey="actual" stroke="#111418" strokeWidth={2} dot={false} />
                <Line name="Forecast" type="monotone" dataKey="mean" stroke="#4F46E5" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {fc.data && (
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent-soft p-3.5 text-body text-text-primary">
              <Brain size={18} className="mt-0.5 flex-shrink-0 text-accent" />
              <p>{fc.data.explanation}</p>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          {fc.data && (
            <Card className="p-5">
              <h3 className="mb-3 text-subtitle font-semibold">Signal</h3>
              <Metric label="Avg weekly demand" value={`${num(fc.data.avg_weekly_demand)} units`} />
              <Metric
                label="Trend"
                value={`${fc.data.trend_per_week > 0 ? "+" : ""}${fc.data.trend_per_week}/wk`}
                icon={fc.data.trend_per_week >= 0 ? TrendingUp : TrendingDown}
                tone={fc.data.trend_per_week >= 0 ? "success" : "danger"}
              />
              <Metric label="Volatility (σ)" value={`±${num(fc.data.volatility)} units`} />
            </Card>
          )}

          {r && (
            <Card className={`p-5 ${r.should_order ? "ring-1 ring-warning" : ""}`}>
              <div className="mb-2 flex items-center gap-2">
                <ShoppingCart size={18} className="text-accent" />
                <h3 className="text-subtitle font-semibold">Reorder recommendation</h3>
              </div>
              {r.should_order ? (
                <>
                  <p className="text-display font-semibold tnum text-accent">
                    {num(r.suggested_order_units)} <span className="text-body font-normal text-text-secondary">units</span>
                  </p>
                  <StatusChip tone="warning">Order recommended</StatusChip>
                </>
              ) : (
                <StatusChip tone="success">Stock sufficient — no order needed</StatusChip>
              )}
              <p className="mt-3 flex items-start gap-2 text-caption text-text-secondary">
                <Lightbulb size={14} className="mt-0.5 flex-shrink-0" />
                {r.rationale}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-caption">
                <KV label="On hand" v={num(r.on_hand)} />
                <KV label="Lead time" v={`${r.lead_time_days} days`} />
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card className="mt-5 p-5">
        <h3 className="mb-3 text-subtitle font-semibold">
          Predicted shortages {shortages.data ? `(${shortages.data.count})` : ""}
        </h3>
        {shortages.loading ? (
          <Skeleton className="h-40" />
        ) : (
          <DataTable
            rows={shortages.data?.results || []}
            rowKey="medicine_id"
            columns={[
              { key: "medicine_label", header: "Medicine", render: (r) => <span className="font-medium">{r.medicine_label}</span> },
              { key: "avg_weekly_demand", header: "Avg/wk", align: "right" },
              { key: "on_hand", header: "On hand", align: "right", render: (r) => num(r.on_hand) },
              { key: "projected_lead_time_demand", header: "Lead-time need", align: "right" },
              { key: "suggested_order_units", header: "Suggested order", align: "right",
                render: (r) => <span className="font-semibold text-accent tnum">{num(r.suggested_order_units)}</span> },
              { key: "supplier", header: "Supplier", render: (r) => r.supplier || "—" },
            ]}
          />
        )}
      </Card>
    </>
  );
}

function Metric({ label, value, icon: Icon, tone }) {
  const c = { success: "text-success-fg", danger: "text-danger-fg" }[tone] || "text-text-primary";
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2 last:border-0">
      <span className="text-caption text-text-secondary">{label}</span>
      <span className={`inline-flex items-center gap-1 text-body font-semibold tnum ${c}`}>
        {Icon && <Icon size={14} />}
        {value}
      </span>
    </div>
  );
}
function KV({ label, v }) {
  return (
    <div className="rounded-md bg-subtle px-2.5 py-1.5">
      <div className="text-text-tertiary">{label}</div>
      <div className="font-semibold tnum text-text-primary">{v}</div>
    </div>
  );
}
