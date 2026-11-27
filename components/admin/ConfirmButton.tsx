"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/auth/ui";
import { Icon } from "@/components/member/icons";
import type { ActionResult } from "@/lib/admin-actions";
import { cn } from "@/lib/utils";

interface ConfirmButtonProps {
  label: string;
  confirmLabel?: string;
  /** Text read out for screen readers, e.g. 'Delete event "Peace Day"'. */
  ariaLabel: string;
  onConfirm: () => Promise<ActionResult>;
  /** Called after success instead of refreshing the current page. */
  onDone?: () => void;
  icon?: boolean;
  className?: string;
}

/** Two-step destructive button: first click asks for confirmation, second performs the action. */
export function ConfirmButton({ label, confirmLabel = "Yes, delete", ariaLabel, onConfirm, onDone, icon = true, className }: ConfirmButtonProps) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm();
      if (result.ok) {
        if (onDone) onDone();
        else router.refresh();
      } else {
        setError(result.error);
        setAsking(false);
      }
    } catch {
      setError("We couldn't reach the server. Please try again.");
      setAsking(false);
    } finally {
      setBusy(false);
    }
  }

  const base =
    "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      {asking ? (
        <span className="inline-flex items-center gap-2" role="group" aria-label="Confirm action">
          <button
            type="button"
            onClick={run}
            disabled={busy}
            aria-label={`Confirm: ${ariaLabel}`}
            className={cn(base, "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            disabled={busy}
            className={cn(base, "border border-input bg-background hover:bg-secondary")}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          aria-label={ariaLabel}
          className={cn(base, "border border-destructive/40 bg-background text-destructive hover:bg-destructive/10", className)}
        >
          {icon ? <Icon name="trash" className="h-4 w-4" /> : null}
          {label}
        </button>
      )}
      {error ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
