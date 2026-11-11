"use client";

import { useState } from "react";
import { Check, AlertTriangle, X } from "lucide-react";

/* Primitives per docs/desgin md §33–41: neutral surfaces, orange only for action. */

export function Button({
  children, variant = "primary", className = "", type = "button", ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-base font-medium min-h-[44px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
  const styles = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    secondary: "bg-elevated border border-line text-text-hi hover:border-text-low",
    ghost: "text-text-mid hover:text-text-hi hover:bg-elevated",
    danger: "bg-transparent border border-danger text-danger hover:bg-danger hover:text-white",
  }[variant];
  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-line rounded-card p-5 ${className}`}>
      {children}
    </div>
  );
}

/** Status = dot + text (never color alone — docs §17). */
const STATUS_TINT: Record<string, string> = {
  active: "bg-accent", pending: "bg-warning", frozen: "bg-text-mid",
  expired: "bg-danger", cancelled: "bg-danger", paid: "bg-accent",
  failed: "bg-danger", open: "bg-danger", in_progress: "bg-warning",
  resolved: "bg-text-mid", inactive: "bg-text-low", suspended: "bg-danger",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-small">
      <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_TINT[status] ?? "bg-text-low"}`} />
      <span className="capitalize text-text-mid">{status.replace("_", " ")}</span>
    </span>
  );
}

export function Input({
  label, error, hint, required, id, ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-small text-text-mid">
        {label} {!required && <span className="text-text-low">(optional)</span>}
      </label>
      <input id={inputId} aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
        aria-invalid={!!error} className={error ? "error" : ""} {...rest} />
      {hint && !error && <p id={`${inputId}-hint`} className="text-caption text-text-low">{hint}</p>}
      {error && <p id={`${inputId}-err`} role="alert" className="text-caption text-danger">{error}</p>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
    </div>
  );
}

/** Useful empty state (docs §39 + interaction-design empty-states rules). */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <p className="text-h3 text-text-hi">{title}</p>
      <p className="max-w-sm text-small text-text-mid">{body}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertTriangle aria-hidden className="text-warning" size={22} />
      <p className="text-small text-text-mid">{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Toast: auto-dismiss 4s, persists on error (feedback-patterns timing). */
export function useToast() {
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const show = (msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    if (kind === "ok") setTimeout(() => setToast(null), 4000);
  };
  const node = toast ? (
    <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div className={`flex items-center gap-2 rounded-btn border px-4 py-3 text-small shadow-lg
        ${toast.kind === "ok" ? "border-line bg-elevated text-text-hi" : "border-danger/40 bg-elevated text-text-hi"}`}>
        {toast.kind === "ok" ? <Check size={16} className="text-accent" /> : <X size={16} className="text-danger" />}
        {toast.msg}
        {toast.kind === "err" && (
          <button aria-label="Dismiss" onClick={() => setToast(null)} className="ml-2 text-text-low hover:text-text-hi">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  ) : null;
  return { show, node };
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close dialog" onClick={onClose}
        className="absolute inset-0 bg-black/60" style={{ transition: "opacity var(--dur-fast)" }} />
      <div className="relative z-10 w-full max-w-lg bg-surface border border-line rounded-modal p-6 max-h-[85vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-text-mid hover:text-text-hi">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-h1">{title}</h1>
      {action}
    </div>
  );
}
