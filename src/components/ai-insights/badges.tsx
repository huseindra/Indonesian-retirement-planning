import type { ConfidenceLabel, InsightStatus } from "@/lib/domain/ai-insights";
import { Icon } from "../icons";

const CONFIDENCE_STYLES: Record<ConfidenceLabel, string> = {
  high: "bg-brand-50 text-brand-800 ring-brand-200",
  medium: "bg-amber-50 text-amber-800 ring-amber-200",
  low: "bg-canvas text-muted ring-line",
};

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLabel }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${CONFIDENCE_STYLES[confidence]}`}
      title="How strongly the underlying figures support this observation — not a guarantee about the future."
    >
      {confidence === "high" ? "High" : confidence === "medium" ? "Medium" : "Low"} confidence
    </span>
  );
}

const STATUS_LABELS: Record<InsightStatus, string> = {
  pending: "New",
  edited: "Edited",
  accepted: "Accepted",
  applied: "Applied to your plan",
  rejected: "Rejected",
  dismissed: "Dismissed",
};

const STATUS_STYLES: Record<InsightStatus, string> = {
  pending: "bg-brand-50 text-brand-800 ring-brand-200",
  edited: "bg-amber-50 text-amber-800 ring-amber-200",
  accepted: "bg-brand-50 text-brand-800 ring-brand-200",
  applied: "bg-brand-600 text-white ring-brand-600",
  rejected: "bg-canvas text-muted ring-line",
  dismissed: "bg-canvas text-muted ring-line",
};

export function StatusBadge({ status }: { status: InsightStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS_STYLES[status]}`}>
      {status === "applied" ? <Icon name="check" className="size-3" /> : null}
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Marks text as the AI's interpretation, distinct from the app's deterministic calculations. */
export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-violet-200">
      <Icon name="sparkle" className="size-3" />
      AI interpretation
    </span>
  );
}
