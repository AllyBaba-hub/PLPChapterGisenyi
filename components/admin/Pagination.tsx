import Link from "next/link";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string>;
}

function href(basePath: string, params: Record<string, string>, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `${basePath}?${text}` : basePath;
}

export function Pagination({ page, totalPages, basePath, params = {} }: PaginationProps) {
  if (totalPages <= 1) return null;
  const linkClass =
    "inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(basePath, params, page - 1)} className={linkClass} rel="prev">
          ← Previous
        </Link>
      ) : (
        <span className={cn(linkClass, "pointer-events-none opacity-50")} aria-hidden="true">
          ← Previous
        </span>
      )}
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      {page < totalPages ? (
        <Link href={href(basePath, params, page + 1)} className={linkClass} rel="next">
          Next →
        </Link>
      ) : (
        <span className={cn(linkClass, "pointer-events-none opacity-50")} aria-hidden="true">
          Next →
        </span>
      )}
    </nav>
  );
}
