import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/admin/BarList";
import { PrintReportButton } from "@/components/admin/PrintReportButton";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass, selectClass } from "@/components/ui/styles";
import { getAdmin, getAdminSettings, getEmailUsageBreakdown } from "@/lib/admin-data";
import { pick, type SearchParams } from "@/lib/admin-query";
import { EMAILJS_MONTHLY_LIMIT, QUOTA_CEILING } from "@/lib/emailjs";
import { ROLE_LABELS } from "@/lib/labels";
import type { UserRole } from "@/lib/rbac";
import { eventEndsAt, formatDate, formatEventWhen } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

interface CountResult {
  count: number | null;
  error: { message: string } | null;
}

async function headCount(query: PromiseLike<CountResult>, label: string): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(`Could not load report data (${label}): ${error.message}`);
  return count ?? 0;
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function kigaliYear(iso: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Africa/Kigali" }).format(new Date(iso)));
}

const ROLE_ORDER: UserRole[] = ["member", "admin", "super_admin", "applicant"];
const PRIORITY_TONE: Record<string, BadgeTone> = { normal: "muted", important: "warning", urgent: "danger" };

interface EventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  max_capacity: number | null;
  is_published: boolean;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card p-6 shadow-sm print:p-4">
      <h2 id={id} className="mb-5 text-xl sm:text-xl print:mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase } = await getAdmin();
  const settings = await getAdminSettings();

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  /* ----------------------------------------------------------- membership */
  const [
    activeMembers,
    suspended,
    newMembers,
    pendingApplications,
    approvedApplications,
    rejectedApplications,
    ...roleCounts
  ] = await Promise.all([
    headCount(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").in("role", ["member", "admin", "super_admin"]), "active members"),
    headCount(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "suspended"), "suspended"),
    headCount(supabase.from("profiles").select("id", { count: "exact", head: true }).gte("joined_at", monthAgo), "new members"),
    headCount(supabase.from("membership_applications").select("id", { count: "exact", head: true }).eq("status", "pending"), "pending applications"),
    headCount(supabase.from("membership_applications").select("id", { count: "exact", head: true }).eq("status", "approved"), "approved applications"),
    headCount(supabase.from("membership_applications").select("id", { count: "exact", head: true }).eq("status", "rejected"), "rejected applications"),
    ...ROLE_ORDER.map((role) =>
      headCount(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", role), `role ${role}`)
    ),
  ]);

  /* --------------------------------------------------------------- events */
  const eventsResult = await supabase
    .from("events")
    .select("id, title, start_time, end_time, max_capacity, is_published")
    .order("start_time", { ascending: false })
    .limit(500);
  if (eventsResult.error) throw new Error(`Could not load report data (events): ${eventsResult.error.message}`);
  const allEvents = (eventsResult.data ?? []) as EventRow[];

  const registrations: Array<{ event_id: string; attended: boolean }> = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await supabase
      .from("event_registrations")
      .select("event_id, attended")
      .order("id", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`Could not load report data (registrations): ${error.message}`);
    registrations.push(...((data ?? []) as Array<{ event_id: string; attended: boolean }>));
    if (!data || data.length < 1000) break;
  }

  const years = Array.from(new Set(allEvents.map((event) => kigaliYear(event.start_time)))).sort((a, b) => b - a);
  const yearParam = Number.parseInt(pick(params, "year"), 10);
  const year = years.includes(yearParam) ? yearParam : null;
  const events = year ? allEvents.filter((event) => kigaliYear(event.start_time) === year) : allEvents;

  const perEvent = new Map<string, { registered: number; attended: number }>();
  for (const row of registrations) {
    const entry = perEvent.get(row.event_id) ?? { registered: 0, attended: 0 };
    entry.registered += 1;
    if (row.attended) entry.attended += 1;
    perEvent.set(row.event_id, entry);
  }

  const eventStats = events.map((event) => {
    const stats = perEvent.get(event.id) ?? { registered: 0, attended: 0 };
    return { ...event, ...stats, ended: eventEndsAt(event) < now };
  });
  const totalRegistrations = eventStats.reduce((sum, event) => sum + event.registered, 0);
  const ended = eventStats.filter((event) => event.ended);
  const endedRegistered = ended.reduce((sum, event) => sum + event.registered, 0);
  const endedAttended = ended.reduce((sum, event) => sum + event.attended, 0);
  const attendanceRate = percent(endedAttended, endedRegistered);
  const publishedEvents = eventStats.filter((event) => event.is_published).length;
  const upcomingEvents = eventStats.filter((event) => event.is_published && !event.ended).length;

  /* ------------------------------------------------------- communication */
  const [
    announcementsTotal,
    announcementsPublished,
    unread,
    read,
    replied,
    archived,
    messagesRecent,
    recentAnnouncements,
    usage,
  ] = await Promise.all([
    headCount(supabase.from("announcements").select("id", { count: "exact", head: true }), "announcements"),
    headCount(supabase.from("announcements").select("id", { count: "exact", head: true }).eq("is_published", true), "published announcements"),
    headCount(supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "unread"), "unread messages"),
    headCount(supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "read"), "read messages"),
    headCount(supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "replied"), "replied messages"),
    headCount(supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "archived"), "archived messages"),
    headCount(supabase.from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", monthAgo), "recent messages"),
    supabase.from("announcements").select("id, title, priority, is_published, created_at").order("created_at", { ascending: false }).limit(5),
    getEmailUsageBreakdown(supabase),
  ]);

  const announcementRows = (recentAnnouncements.data ?? []) as Array<{ id: string; title: string; priority: string; is_published: boolean; created_at: string }>;
  const totalMessages = unread + read + replied + archived;
  const usagePercent = Math.min(100, Math.round((usage.total / EMAILJS_MONTHLY_LIMIT) * 100));

  const generated = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Kigali" }).format(now);
  const periodLabel = year ? `Events in ${year}` : "All events";

  return (
    <div className="space-y-6 print:space-y-4">
      <PageHeading
        title="Chapter report"
        description="A printable summary of membership, events and communications. Use Print to save it as a PDF."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <form method="get" className="flex items-end gap-2" aria-label="Choose report period">
              <div>
                <label htmlFor="year" className="mb-1.5 block text-sm font-medium">
                  Event period
                </label>
                <select id="year" name="year" defaultValue={year ? String(year) : ""} className={`${selectClass} w-auto min-w-[9rem]`}>
                  <option value="">All years</option>
                  {years.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className={buttonClass("outline")}>
                Apply
              </button>
              {year ? (
                <Link href="/admin/reports" className={buttonClass("ghost")}>
                  Reset
                </Link>
              ) : null}
            </form>
            <PrintReportButton />
          </div>
        }
      />

      <div className="hidden border-b pb-4 print:block">
        <h1 className="text-2xl">{settings.chapter_name}: chapter report</h1>
        <p className="mt-1 text-sm">
          {settings.parent_organization} · {settings.district_location}
        </p>
        <p className="text-sm">
          {periodLabel} · Generated {generated} (Rwanda time)
        </p>
      </div>

      {/* ------------------------------------------------------------ membership */}
      <Section id="membership-heading" title="Membership">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active members" value={String(activeMembers)} hint="Members, admins and super admins" />
          <Stat label="Pending applications" value={String(pendingApplications)} hint="Waiting for review" />
          <Stat label="Suspended accounts" value={String(suspended)} />
          <Stat label="Joined, last 30 days" value={String(newMembers)} />
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-3 text-base font-semibold tracking-tight sm:text-base">Role distribution</h3>
            <BarList
              ariaLabel="Accounts by role"
              items={ROLE_ORDER.map((role, index) => ({
                label: ROLE_LABELS[role],
                value: roleCounts[index] ?? 0,
                tone: role === "member" ? "primary" : role === "applicant" ? "muted" : "success",
              }))}
            />
          </div>
          <div>
            <h3 className="mb-3 text-base font-semibold tracking-tight sm:text-base">Application outcomes</h3>
            <BarList
              ariaLabel="Applications by outcome"
              items={[
                { label: "Pending", value: pendingApplications, tone: "warning" },
                { label: "Approved", value: approvedApplications, tone: "success" },
                { label: "Rejected", value: rejectedApplications, tone: "danger" },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Approval rate of decided applications:{" "}
              {percent(approvedApplications, approvedApplications + rejectedApplications) === null
                ? "not available yet"
                : `${percent(approvedApplications, approvedApplications + rejectedApplications)}%`}
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- events */}
      <Section id="events-heading" title={`Events & participation (${periodLabel.toLowerCase()})`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total events" value={String(eventStats.length)} hint={`${publishedEvents} published`} />
          <Stat label="Upcoming" value={String(upcomingEvents)} hint="Published and still to come" />
          <Stat label="Registrations" value={String(totalRegistrations)} />
          <Stat
            label="Attendance rate"
            value={attendanceRate === null ? "—" : `${attendanceRate}%`}
            hint={ended.length > 0 ? `${endedAttended} of ${endedRegistered} registrations at ended events` : "No ended events with registrations"}
          />
        </div>

        <h3 className="mb-3 mt-6 text-base font-semibold tracking-tight sm:text-base">Attendance by event</h3>
        {eventStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm print:min-w-0">
              <caption className="sr-only">Registrations and attendance for each event</caption>
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-semibold">Event</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Registered</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Attended</th>
                  <th scope="col" className="py-2 pl-3 text-right font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {eventStats.map((event) => {
                  const rate = event.ended ? percent(event.attended, event.registered) : null;
                  return (
                    <tr key={event.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{formatEventWhen(event.start_time, event.end_time)}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        {!event.is_published ? "Draft" : event.ended ? "Ended" : "Upcoming"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {event.registered}
                        {event.max_capacity ? ` / ${event.max_capacity}` : ""}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{event.ended ? event.attended : "—"}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">{rate === null ? "—" : `${rate}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* --------------------------------------------------------- communication */}
      <Section id="communication-heading" title="Communication & activity">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Announcements" value={String(announcementsTotal)} hint={`${announcementsPublished} visible to members`} />
          <Stat label="Unread messages" value={String(unread)} />
          <Stat label="Replied messages" value={String(replied)} hint={totalMessages > 0 ? `${percent(replied, totalMessages)}% of all messages` : undefined} />
          <Stat label="Messages, last 30 days" value={String(messagesRecent)} />
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-3 text-base font-semibold tracking-tight sm:text-base">Contact messages by status</h3>
            <BarList
              ariaLabel="Contact messages by status"
              items={[
                { label: "Unread", value: unread, tone: "primary" },
                { label: "Read", value: read, tone: "muted" },
                { label: "Replied", value: replied, tone: "success" },
                { label: "Archived", value: archived, tone: "muted" },
              ]}
            />
          </div>

          <div>
            <h3 className="mb-3 text-base font-semibold tracking-tight sm:text-base">EmailJS free tier, this month</h3>
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              {usage.total} <span className="text-base font-medium text-muted-foreground">of {EMAILJS_MONTHLY_LIMIT} requests</span>
            </p>
            <div aria-hidden="true" className="print-exact mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={usagePercent >= 90 ? "h-full bg-destructive" : usagePercent >= 70 ? "h-full bg-warning" : "h-full bg-primary"}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {usage.activity} for activity alerts · {usage.account} for account notices · {usage.sends} send
              {usage.sends === 1 ? "" : "s"} recorded
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Alerts stop at {QUOTA_CEILING.activity} requests and notices at {QUOTA_CEILING.account}. Counted from emails sent through this admin area; the EmailJS dashboard is the source of truth.
            </p>
          </div>
        </div>

        <h3 className="mb-3 mt-6 text-base font-semibold tracking-tight sm:text-base">Recent announcements</h3>
        {announcementRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <ul className="divide-y">
            {announcementRows.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge tone={PRIORITY_TONE[item.priority] ?? "muted"}>{item.priority}</Badge>
                  <Badge tone={item.is_published ? "success" : "muted"}>{item.is_published ? "Visible" : "Hidden"}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-xs text-muted-foreground print:mt-4">
        Report generated {generated} (Rwanda time) from live chapter data. Contains aggregate figures only.
      </p>
    </div>
  );
}
