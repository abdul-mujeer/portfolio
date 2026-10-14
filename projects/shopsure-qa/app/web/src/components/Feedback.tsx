import type { ReactNode } from "react";

export function ErrorBanner({ message, details }: { message: string; details?: string[] }) {
  return (
    <div className="banner banner-error" role="alert" data-testid="error-banner">
      <strong>{message}</strong>
      {details && details.length > 0 && (
        <ul>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="banner banner-success" role="status" data-testid="success-banner">
      {message}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status" data-testid="loading-state">
      {label}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  PENDING: "tone-warn",
  PAID: "tone-info",
  SHIPPED: "tone-info",
  DELIVERED: "tone-ok",
  CANCELED: "tone-muted",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${STATUS_TONES[status] ?? "tone-muted"}`} data-testid="status-badge">
      {status}
    </span>
  );
}
