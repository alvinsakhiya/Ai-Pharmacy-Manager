import { AlertTriangle, BellOff } from "lucide-react";

import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { KpiCard } from "../../components/ui/KpiCard";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel, PanelBody, PanelHeader } from "../../components/ui/Card";
import { SkeletonRows } from "../../components/ui/Skeleton";
import type { Alert, AlertCategory, AlertSeverity } from "./notificationsApi";
import { useAlertsQuery } from "./useNotifications";

const SUMMARY_LABELS = [
  { key: "total", label: "Total" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "info", label: "Info" },
] as const;

const SEVERITY_BADGE: Record<AlertSeverity, BadgeVariant> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  stock: "Stock",
  dosette: "Dosette",
};

function SubjectDetails({ alert }: { alert: Alert }) {
  if (alert.category === "stock") {
    return (
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        {[alert.subject.medication_name, `Pharmacy ${alert.pharmacy_id}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
    );
  }

  if (alert.category === "dosette") {
    return (
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        {[
          alert.subject.cycle_reference
            ? `Cycle ${alert.subject.cycle_reference}`
            : null,
          alert.subject.patient_reference
            ? `Patient ${alert.subject.patient_reference}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    );
  }

  return null;
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elev-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_BADGE[alert.severity]} dot>
          {alert.severity}
        </Badge>
        <Badge variant="neutral">{CATEGORY_LABELS[alert.category]}</Badge>
      </div>
      <h2 className="mt-4 text-base font-bold tracking-[-0.01em] text-ink">
        {alert.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {alert.message}
      </p>
      <SubjectDetails alert={alert} />
    </article>
  );
}

export function AlertsScreen() {
  const alertsQuery = useAlertsQuery();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live alerts"
        title="Alerts"
        subtitle="Operational stock and Dosette/MDS alerts."
      />

      {alertsQuery.isLoading ? (
        <Panel>
          <PanelHeader title="Alerts" subtitle="Loading alerts..." />
          <PanelBody>
            <SkeletonRows rows={4} />
          </PanelBody>
        </Panel>
      ) : null}

      {alertsQuery.isError ? (
        <EmptyState
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          title="Could not load alerts."
          description="Please retry. Your session or permissions may need refreshing."
          action={
            <Button
              variant="danger"
              onClick={() => void alertsQuery.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {alertsQuery.isSuccess ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {SUMMARY_LABELS.map((summary) => (
              <KpiCard
                key={summary.key}
                label={summary.label}
                value={alertsQuery.data.summary[summary.key]}
              />
            ))}
            <KpiCard
              label="Stock"
              value={alertsQuery.data.summary.by_category.stock}
            />
            <KpiCard
              label="Dosette"
              value={alertsQuery.data.summary.by_category.dosette}
            />
          </section>

          {alertsQuery.data.alerts.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-5 w-5" aria-hidden="true" />}
              title="No active alerts."
              description="Everything in your scope is clear. New stock and Dosette/MDS signals will surface here."
            />
          ) : (
            <section className="space-y-3">
              {alertsQuery.data.alerts.map((alert) => (
                <AlertCard alert={alert} key={alert.id} />
              ))}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
