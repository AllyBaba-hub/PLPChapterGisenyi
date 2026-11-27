import type { Metadata } from "next";
import Link from "next/link";
import { DeleteEventButton } from "@/components/admin/DeleteEventButton";
import { Pagination } from "@/components/admin/Pagination";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { Icon } from "@/components/member/icons";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/styles";
import { getAdmin } from "@/lib/admin-data";
import { oneOf, pageParam, pageRange, pick, totalPages, PAGE_SIZE, type SearchParams } from "@/lib/admin-query";
import { cn, eventEndsAt, formatEventWhen } from "@/lib/utils";

export const metadata: Metadata = { title: "Events" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "drafts", label: "Drafts" },
] as const;

interface Row {
  id: string;
  slug: string;
  title: string;
  location: string;
  start_time: string;
  end_time: string | null;
  max_capacity: number | null;
  is_published: boolean;
}

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase } = await getAdmin();

  const filter = oneOf(pick(params, "filter"), ["upcoming", "past", "drafts"] as const) || "all";
  const page = pageParam(params);
  const { from, to } = pageRange(page);
  const now = new Date().toISOString();

  let query = supabase
    .from("events")
    .select("id, slug, title, location, start_time, end_time, max_capacity, is_published", { count: "exact" })
    .order("start_time", { ascending: filter === "upcoming" })
    .range(from, to);
  if (filter === "upcoming") query = query.gte("start_time", now);
  if (filter === "past") query = query.lt("start_time", now);
  if (filter === "drafts") query = query.eq("is_published", false);

  const [{ data, count, error }, counts] = await Promise.all([query, supabase.rpc("event_registration_counts")]);
  if (error) throw new Error(`Could not load events: ${error.message}`);

  const rows = (data ?? []) as Row[];
  const registered = new Map<string, number>();
  for (const row of (counts.data ?? []) as Array<{ event_id: string; registered_count: number }>) {
    registered.set(row.event_id, Number(row.registered_count));
  }
  const pages = totalPages(count ?? 0, PAGE_SIZE);
  const current = new Date();

  return (
    <div>
      <PageHeading
        title="Events"
        description="Create, publish and manage chapter events and their registrations."
        actions={
          <Link href="/admin/events/new" className={buttonClass("primary")}>
            <Icon name="plus" className="h-4 w-4" />
            New event
          </Link>
        }
      />

      <nav aria-label="Filter events" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "all" ? "/admin/events" : `/admin/events?filter=${item.id}`}
            aria-current={filter === item.id ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === item.id ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-secondary"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No events in this view.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((event) => {
            const ended = eventEndsAt(event) < current;
            const count = registered.get(event.id) ?? 0;
            return (
              <li key={event.id} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={event.is_published ? "success" : "muted"}>{event.is_published ? "Published" : "Draft"}</Badge>
                      {ended ? <Badge tone="muted">Ended</Badge> : null}
                    </div>
                    <h2 className="mt-2 text-lg sm:text-lg">{event.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{formatEventWhen(event.start_time, event.end_time)}</p>
                    <p className="text-sm text-muted-foreground">{event.location}</p>
                  </div>
                  <p className="text-sm font-medium">
                    {event.is_published ? `${count}${event.max_capacity ? ` / ${event.max_capacity}` : ""} registered` : "Not open for registration"}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-start gap-2 border-t pt-4">
                  <Link href={`/admin/events/${event.id}/edit`} className={buttonClass("outline")}>
                    <Icon name="pencil" className="h-4 w-4" />
                    Edit
                  </Link>
                  <Link href={`/admin/events/${event.id}/registrations`} className={buttonClass("outline")}>
                    <Icon name="users" className="h-4 w-4" />
                    Registrations
                  </Link>
                  <PublishToggle kind="event" id={event.id} published={event.is_published} />
                  <DeleteEventButton id={event.id} title={event.title} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} totalPages={pages} basePath="/admin/events" params={{ filter: filter === "all" ? "" : filter }} />
    </div>
  );
}
