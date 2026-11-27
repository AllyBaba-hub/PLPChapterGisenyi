import type { ReactNode } from "react";

export const labelClass = "mb-1.5 block text-sm font-medium text-foreground";

export const inputClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60";

export const primaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-secondary px-4 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60";

export const linkClass =
  "rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type AlertVariant = "error" | "success" | "info" | "warning";

const alertStyles: Record<AlertVariant, string> = {
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  success: "border-success/50 bg-success/10 text-foreground",
  info: "border-primary/30 bg-accent text-accent-foreground",
  warning: "border-warning/60 bg-warning/10 text-foreground",
};

interface AuthAlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  id?: string;
}

export function AuthAlert({ variant, title, children, id }: AuthAlertProps) {
  return (
    <div
      id={id}
      role={variant === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${alertStyles[variant]}`}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
