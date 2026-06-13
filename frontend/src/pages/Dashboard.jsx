import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarClock,
  PackageX,
  PoundSterling,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Card, Skeleton, StatusChip } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { gbp, num, dateTimeFmt } from "../lib/format";
import { useAuth } from "../context/AuthContext";

function StatCard({ icon: Icon, label, value, sub, tone = "accent", onClick }) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    warning: "bg-warning-bg text-warning-fg",
    danger: "bg-danger-bg text-danger-fg",
    success: "bg-success-bg text-success-fg",
    info: "bg-info-bg text-info-fg",
  };
  return (
    <Card
      as={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full p-4 text-left transition-all duration-150 ease ${onClick ? "cursor-pointer hover:shadow-elev-2 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-accent-ring" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-caption font-medium text-text-secondary">{label}</p>
          <p className="mt-1 text-display font-semibold tnum text-text-primary">{value}</p>
          {sub && <p className="mt-0.5 text-caption text-text-tertiary">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={18} aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}

const EXPIRY_COLORS = { within_30: "#E8A100", within_90: "#C9A227", within_180: "#7BA05B", expired: "#E0402F" };

export default function Dashboard() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data, loading } = useFetch("/dashboard/");
  const { data: trend } = useFetch("/dashboard/stock-trend/", { params: { days: 90 } });
  const { data: fc } = useFetch("/forecast/summary/");

  if (loading || !data)
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Operational overview" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {["patients", "dosette", "medicines", "value", "low-stock", "expiry", "shortages", "cycles"].map((key) => (
            <Skeleton key={key} className="h-24" />
          ))}
        </div>
      </>
    );

  const expiryData = [
    { name: "Expired", key: "expired", value: data.expiry.expired, fill: EXPIRY_COLORS.expired },
    { name: "≤30d", key: "within_30", value: data.expiry.within_30, fill: EXPIRY_COLORS.within_30 },
    { name: "≤90d", key: "within_90", value: data.expiry.within_90, fill: EXPIRY_COLORS.within_90 },
    { name: "≤180d", key: "within_180", value: data.expiry.within_180, fill: EXPIRY_COLORS.within_180 },
  ];

  const trendData = (trend || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    units: d.total,
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Operational overview across dosette care and stock"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total patients" value={num(data.patients.total)}
          sub={`${num(data.patients.active)} active`} tone="info"
          onClick={can("administrator") ? () => navigate("/patients") : undefined} />
        <StatCard icon={CalendarClock} label="Dosette patients" value={num(data.patients.dosette)}
          sub={`${data.dosette.active_plans} active plans`} tone="accent" onClick={() => navigate("/dosette")} />
        <StatCard icon={Boxes} label="Medicines in stock" value={num(data.stock.medicines)}
          sub={`${num(data.stock.units_on_hand)} units on hand`} tone="success" onClick={() => navigate("/stock")} />
        <StatCard icon={PoundSterling} label="Stock value" value={gbp(data.stock.total_value)} tone="accent" />
        <StatCard icon={AlertTriangle} label="Low stock alerts" value={num(data.stock.low_stock)}
          tone="warning" onClick={() => navigate("/stock")} />
        <StatCard icon={PackageX} label="Expiring ≤30 days" value={num(data.expiry.within_30)}
          sub={`${data.expiry.expired} expired`} tone="danger" onClick={() => navigate("/expiry")} />
        <StatCard icon={TrendingUp} label="Predicted shortages" value={fc ? num(fc.predicted_shortages) : "—"}
          sub={fc ? `${fc.rising_demand} rising demand` : ""} tone="warning" onClick={() => navigate("/forecasting")} />
        <StatCard icon={CalendarClock} label="Cycles due (7d)" value={num(data.dosette.cycles_due_7d)}
          sub={`${data.dosette.reviews_overdue} reviews overdue`} tone="info" onClick={() => navigate("/dosette")} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-subtitle font-semibold">Dispensing demand · last 90 days</h3>
            <StatusChip tone="info" icon={false}>Daily units</StatusChip>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ left: -16, right: 8 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9099A4" }} interval={Math.ceil(trendData.length / 8)} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9099A4" }} tickLine={false} axisLine={false} width={42} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6E8EC", fontSize: 12 }} />
              <Area type="monotone" dataKey="units" stroke="#4F46E5" strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-subtitle font-semibold">Expiry exposure (batches)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={expiryData} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EC" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9099A4" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9099A4" }} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E6E8EC", fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={18} className="text-text-secondary" />
          <h3 className="text-subtitle font-semibold">Recent activity</h3>
        </div>
        <ul className="divide-y divide-border-subtle">
          {(data.recent_activity || []).map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="text-body text-text-primary">{a.summary}</span>
              </div>
              <div className="flex items-center gap-3 text-caption text-text-tertiary">
                <span>{a.actor}</span>
                <span>{dateTimeFmt(a.timestamp)}</span>
              </div>
            </li>
          ))}
          {(!data.recent_activity || data.recent_activity.length === 0) && (
            <li className="py-6 text-center text-body text-text-tertiary">No recent activity.</li>
          )}
        </ul>
      </Card>
    </>
  );
}
