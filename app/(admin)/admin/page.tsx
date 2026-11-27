import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/member/icons";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/styles";
import { getAdmin } from "@/lib/admin-data";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

function Metric({ href, icon, label, value, hint }: { href: string; icon: IconName; label: string; value: number; hint: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon name={icon} />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </Link>
  );
}

const PRIORITY_TONE: Record<string, BadgeTone> = { normal: "muted", important: "warning", urgent: "danger" };

export default async function AdminOverviewPage() {
  const { supabase, profile } = await getAdmin();
  const now = new Date().toISOString();

  const [pending, members, upcoming, unread, announcements, activity] = await Promise.all([
    supabase.from("membership_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").in("role", ["member", "admin", "super_admin"]),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("is_published", true).gte("start_time", now),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "unread"),
    supabase.from("announcements").select("id, title, priority, is_published, created_at").order("created_at", { ascending: false }).limit(4),
    supabase.from("audit_logs").select("id, action, actor_email, entity_type, created_at").order("created_at", { ascending: false }).limit(6),
  ]);

  const announcementRows = (announcements.data ?? []) as Array<{ id: string; title: string; priority: string; is_published: boolean; created_at: string }>;
  const activityRows = (activity.data ?? []) as Array<{ id: string; action: string; actor_email: string | null; entity_type: string; created_at: string }>;

  return (
    <div className="space-y-8">
      <PageHeading title={`Hello, ${profile.full_name.split(" ")[0]}`} description="A snapshot of what needs attention in the chapter today." />

      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric href="/admin/applications" icon="clipboard" label="Pending applications" value={pending.count ?? 0} hint="Waiting for review" />
        <Metric href="/admin/members" icon="users" label="Active members" value={members.count ?? 0} hint="Members, admins and super admins" />
        <Metric href="/admin/events" icon="calendar" label="Upcoming events" value={upcoming.count ?? 0} hint="Published and still to come" />
        <Metric href="/admin/messages" icon="mail" label="Unread messages" value={unread.count ?? 0} hint="From the contact form" />
      </section>

      <section aria-labelledby="quick-actions-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="quick-actions-heading" className="mb-4 text-lg sm:text-lg">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/events/new" className={buttonClass("primary")}>
            <Icon name="plus" className="h-4 w-4" />
            New event
          </Link>
          <Link href="/admin/news/new" className={buttonClass("outline")}>
            <Icon name="plus" className="h-4 w-4" />
            New article
          </Link>
          <Link href="/admin/announcements" className={buttonClass("outline")}>
            <Icon name="bell" className="h-4 w-4" />
            Post announcement
          </Link>
          <Link href="/admin/gallery" className={buttonClass("outline")}>
            <Icon name="image" className="h-4 w-4" />
            Add to gallery
          </Link>
          <Link href="/admin/applications" className={buttonClass("outline")}>
            <Icon name="clipboard" className="h-4 w-4" />
            Review applications
          </Link>
          <Link href="/admin/reports" className={buttonClass("outline")}>
            <Icon name="chart" className="h-4 w-4" />
            Chapter report
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="recent-announcements-heading" className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="recent-announcements-heading" className="text-lg sm:text-lg">
              Recent announcements
            </h2>
            <Link href="/admin/announcements" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Manage
            </Link>
          </div>
          {announcementRows.length > 0 ? (
            <ul className="divide-y">
              {announcementRows.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone={PRIORITY_TONE[item.priority] ?? "muted"}>{item.priority}</Badge>
                    {!item.is_published ? <Badge tone="muted">Hidden</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          )}
        </section>

        <section aria-labelledby="recent-activity-heading" className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="recent-activity-heading" className="text-lg sm:text-lg">
              Recent activity
            </h2>
            <Link href="/admin/audit-logs" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Audit logs
            </Link>
          </div>
          {activityRows.length > 0 ? (
            <ul className="divide-y">
              {activityRows.map((row) => (
                <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-mono text-xs font-semibold">{row.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.actor_email ?? "System"} · {formatDate(row.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
