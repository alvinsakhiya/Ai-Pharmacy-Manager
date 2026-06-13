import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Button, Card, EmptyState, StatusChip, Skeleton, useToast } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import api from "../api/client";
import { dateTimeFmt } from "../lib/format";

const TONE = { info: "info", warning: "warning", danger: "danger", success: "success" };
const CAT_LABEL = {
  low_stock: "Low stock",
  expiry: "Expiry",
  shortage: "Predicted shortage",
  review: "Overdue review",
  announcement: "Announcement",
};

export default function Notifications() {
  const toast = useToast();
  const { data, loading, refetch } = useFetch("/notifications/", { params: { ordering: "-created_at", page_size: 200 } });

  async function refresh() {
    await api.post("/notifications/refresh/");
    toast.success("Alerts refreshed");
    refetch();
  }
  async function markAll() {
    await api.post("/notifications/mark-all-read/");
    refetch();
  }
  async function markRead(n) {
    await api.post(`/notifications/${n.id}/mark-read/`);
    refetch();
  }

  const items = data?.results || [];

  return (
    <>
      <PageHeader
        title="Notification centre"
        subtitle="Low stock, expiries, predicted shortages and overdue reviews"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={markAll}><CheckCheck size={16} /> Mark all read</Button>
            <Button onClick={refresh}><RefreshCw size={16} /> Refresh alerts</Button>
          </div>
        }
      />

      <Card className="p-2">
        {loading ? (
          <div className="space-y-2 p-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" hint="No active notifications. Refresh to re-scan operational state." />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {items.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-3 py-3 transition-colors ${n.is_read ? "opacity-60" : "bg-accent-soft/30"}`}
              >
                <div className="mt-0.5">
                  <StatusChip tone={TONE[n.level]} icon={false} dot>{CAT_LABEL[n.category] || n.category}</StatusChip>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium text-text-primary">{n.title}</div>
                  {n.message && <div className="text-caption text-text-secondary">{n.message}</div>}
                  <div className="mt-0.5 text-caption text-text-tertiary">{dateTimeFmt(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n)} className="text-caption font-medium text-accent hover:underline">
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
