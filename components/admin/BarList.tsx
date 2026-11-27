import { cn } from "@/lib/utils";

export type BarTone = "primary" | "success" | "warning" | "danger" | "muted";

const TONES: Record<BarTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
};

export interface BarItem {
  label: string;
  value: number;
  tone?: BarTone;
}

/** Simple horizontal bars; every value is also printed as text so it reads without colour. */
export function BarList({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul aria-label={ariaLabel} className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{item.label}</span>
            <span className="font-semibold tabular-nums">{item.value}</span>
          </div>
          <div aria-hidden="true" className="print-exact mt-1 h-2 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", TONES[item.tone ?? "primary"])} style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
