import type { ReactNode } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  MinusCircle,
  Timer,
} from "lucide-react";

import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import type { ReviewPriority, ReviewStatus } from "./reviewsApi";

const STATUS_META: Record<
  ReviewStatus,
  { variant: BadgeVariant; icon: ReactNode }
> = {
  PENDING: { variant: "neutral", icon: <Clock className="h-3.5 w-3.5" /> },
  IN_REVIEW: { variant: "info", icon: <Timer className="h-3.5 w-3.5" /> },
  COMPLETED: {
    variant: "success",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  CANCELLED: {
    variant: "neutral",
    icon: <MinusCircle className="h-3.5 w-3.5" />,
  },
};

const PRIORITY_META: Record<
  ReviewPriority,
  { variant: BadgeVariant; icon: ReactNode }
> = {
  ROUTINE: { variant: "neutral", icon: <MinusCircle className="h-3.5 w-3.5" /> },
  ATTENTION: {
    variant: "warning",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  URGENT: { variant: "danger", icon: <Flame className="h-3.5 w-3.5" /> },
};

// API-supplied enum values fall back to a neutral badge rather than crashing
// the whole route on an unrecognised value.
const FALLBACK_META: { variant: BadgeVariant; icon: ReactNode } = {
  variant: "neutral",
  icon: <MinusCircle className="h-3.5 w-3.5" />,
};

function label(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const meta = STATUS_META[status] ?? FALLBACK_META;
  return (
    <Badge variant={meta.variant} icon={meta.icon}>
      {label(status)}
    </Badge>
  );
}

export function ReviewPriorityBadge({
  priority,
}: {
  priority: ReviewPriority;
}) {
  const meta = PRIORITY_META[priority] ?? FALLBACK_META;
  return (
    <Badge variant={meta.variant} icon={meta.icon}>
      {label(priority)}
    </Badge>
  );
}

export function ReviewOverdueBadge() {
  return (
    <Badge variant="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
      Overdue
    </Badge>
  );
}
