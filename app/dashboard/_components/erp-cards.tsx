import type { ReactNode } from "react";
import { formatLabel } from "../_lib/formatters";

export function KpiStatementCard({
  icon,
  title,
  value,
  description,
  details
}: {
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
  details: Array<{ label: string; value: string }>;
}) {
  return (
    <article className="statement-card">
      <div className="statement-icon">{icon}</div>
      <div className="statement-copy">
        <div className="statement-heading">
          <h3>{title}</h3>
          <strong>{value}</strong>
        </div>
        <p>{description}</p>
        <div className="statement-details">
          {details.map((detail) => (
            <div key={detail.label}>
              <span>{detail.label}</span>
              <strong>{detail.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function RatioCard({
  title,
  description,
  value,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue
}: {
  title: string;
  description: string;
  value: string;
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}) {
  return (
    <article className="ratio-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <strong className="ratio-value">{value}</strong>
      <div className="ratio-details">
        <div>
          <span>{leftLabel}</span>
          <strong>{leftValue}</strong>
        </div>
        <div>
          <span>{rightLabel}</span>
          <strong>{rightValue}</strong>
        </div>
      </div>
    </article>
  );
}

export function SmallIndicatorCard({
  title,
  value,
  description
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="small-indicator-card">
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p>{description}</p>
    </article>
  );
}

export function StatusPill({ status }: { status: string }) {
  const knownStatuses = new Set([
    "uploaded",
    "queued",
    "extracting_text",
    "text_extracted",
    "ocr_required",
    "ocr_processing",
    "ai_processing",
    "needs_review",
    "open",
    "in_review",
    "failed",
    "rejected",
    "approved",
    "succeeded"
  ]);
  const className = knownStatuses.has(status)
    ? `status-pill ${status}`
    : "status-pill default";

  return <span className={className}>{formatLabel(status)}</span>;
}
