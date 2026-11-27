import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/admin/Pagination";
import { inputClass } from "@/components/auth/ui";
import { PageHeading } from "@/components/member/PageHeading";
import { buttonClass, selectClass } from "@/components/ui/styles";
import { getAdmin } from "@/lib/admin-data";
import { oneOf, pageParam, pageRange, pick, searchTerm, totalPages, type SearchParams } from "@/lib/admin-query";

export const metadata: Metadata = { title: "Audit logs" };

const LOG_PAGE_SIZE = 50;
const ENTITY_TYPES = ["auth", "application", "member", "event", "news", "gallery", "announcement", "message", "settings", "notification"] as const;
const KNOWN_ACTIONS = [
  "AUTH_FAILED_LOGIN", "AUTH_PASSWORD_RESET_REQUESTED", "AUTH_PASSWORD_RESET", "AUTH_PASSWORD_CHANGED",
  "APPLICATION_APPROVED", "APPLICATION_REJECTED", "ROLE_CHANGED", "MEMBER_STATUS_CHANGED", "MEMBERS_EXPORTED",
  "EVENT_CREATED", "EVENT_UPDATED", "EVENT_PUBLISHED", "EVENT_UNPUBLISHED", "EVENT_DELETED", "ATTENDANCE_UPDATED",
  "NEWS_CREATED", "NEWS_UPDATED", "NEWS_PUBLISHED", "NEWS_UNPUBLISHED", "NEWS_DELETED",
  "GALLERY_CREATED", "GALLERY_UPDATED", "GALLERY_DELETED", "ANNOUNCEMENT_CREATED", "ANNOUNCEMENT_UPDATED",
  "ANNOUNCEMENT_DELETED", "MESSAGE_STATUS_CHANGED", "SETTINGS_UPDATED", "EMAIL_NOTIFICATION_SENT",
];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface LogRow {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

function formatStamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Kigali" }).format(new Date(value));
}

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase } = await getAdmin();

  const actor = searchTerm(pick(params, "actor"));
  const action = searchTerm(pick(params, "action")).toUpperCase().replace(/\s+/g, "_");
  const entity = oneOf(pick(params, "entity"), ENTITY_TYPES);
  const fromDate = DATE_PATTERN.test(pick(params, "from")) ? pick(params, "from") : "";
  const toDate = DATE_PATTERN.test(pick(params, "to")) ? pick(params, "to") : "";
  const page = pageParam(params);
  const { from, to } = pageRange(page, LOG_PAGE_SIZE);

  let query = supabase
    .from("audit_logs")
    .select("id, actor_email, action, entity_type, entity_id, metadata, ip_address, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (actor) query = query.ilike("actor_email", `%${actor}%`);
  if (action) query = query.ilike("action", `%${action}%`);
  if (entity) query = query.eq("entity_type", entity);
  // Dates are interpreted as whole days in Rwanda time (UTC+2).
  if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00+02:00`);
  if (toDate) query = query.lte("created_at", `${toDate}T23:59:59.999+02:00`);

  const { data, count, error } = await query;
  if (error) throw new Error(`Could not load audit logs: ${error.message}`);
  const rows = (data ?? []) as LogRow[];

  return (
    <div>
      <PageHeading title="Audit logs" description="A read-only trail of administrative and security events. Times are shown in Rwanda time." />

      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" role="search" aria-label="Filter audit logs">
        <div className="lg:col-span-2">
          <label htmlFor="actor" className="mb-1.5 block text-sm font-medium">Actor email</label>
          <input id="actor" name="actor" type="search" defaultValue={actor} placeholder="name@example.org" className={inputClass} />
        </div>
        <div>
          <label htmlFor="action" className="mb-1.5 block text-sm font-medium">Action</label>
          <input id="action" name="action" list="known-actions" defaultValue={action} placeholder="ROLE_CHANGED" className={inputClass} />
          <datalist id="known-actions">
            {KNOWN_ACTIONS.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="entity" className="mb-1.5 block text-sm font-medium">Entity</label>
          <select id="entity" name="entity" defaultValue={entity} className={selectClass}>
            <option value="">Any</option>
            {ENTITY_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="mb-1.5 block text-sm font-medium">From</label>
          <input id="from" name="from" type="date" defaultValue={fromDate} className={inputClass} />
        </div>
        <div>
          <label htmlFor="to" className="mb-1.5 block text-sm font-medium">To</label>
          <input id="to" name="to" type="date" defaultValue={toDate} className={inputClass} />
        </div>
        <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
          <button type="submit" className={buttonClass("primary")}>Apply filters</button>
          <Link href="/admin/audit-logs" className={buttonClass("ghost")}>Reset</Link>
          <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
            {count ?? 0} entr{count === 1 ? "y" : "ies"}
          </p>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No log entries match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Audit log entries</caption>
            <thead className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">When</th>
                <th scope="col" className="px-4 py-3 font-semibold">Actor</th>
                <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                <th scope="col" className="px-4 py-3 font-semibold">Entity</th>
                <th scope="col" className="px-4 py-3 font-semibold">IP</th>
                <th scope="col" className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y align-top">
              {rows.map((row) => {
                const hasMetadata = row.metadata && Object.keys(row.metadata).length > 0;
                return (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatStamp(row.created_at)}</td>
                    <td className="px-4 py-3">{row.actor_email ?? <span className="text-muted-foreground">System</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{row.action}</td>
                    <td className="px-4 py-3">
                      <span>{row.entity_type}</span>
                      {row.entity_id ? <span className="block max-w-[10rem] truncate font-mono text-xs text-muted-foreground" title={row.entity_id}>{row.entity_id}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{row.ip_address ?? "—"}</td>
                    <td className="px-4 py-3">
                      {hasMetadata ? (
                        <details>
                          <summary className="cursor-pointer text-xs font-semibold text-primary">View</summary>
                          <pre className="mt-2 max-w-xs overflow-x-auto rounded-md bg-secondary p-2 text-xs">{JSON.stringify(row.metadata, null, 2)}</pre>
                        </details>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages(count ?? 0, LOG_PAGE_SIZE)}
        basePath="/admin/audit-logs"
        params={{ actor, action, entity, from: fromDate, to: toDate }}
      />
    </div>
  );
}
