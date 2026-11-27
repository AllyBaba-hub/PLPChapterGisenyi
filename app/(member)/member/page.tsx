import type { Metadata } from "next";
import Link from "next/link";
import { AuthAlert } from "@/components/auth/ui";
import { Icon, type IconName } from "@/components/member/icons";
import { Badge } from "@/components/ui/Badge";
import { firstParam } from "@/lib/auth-messages";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/labels";
import {
  getAnnouncements,
  getMember,
  getMemberEvents,
  getRecentNews,
  type AnnouncementView,
  type EventWithRsvp,
} from "@/lib/member-data";
import type { NewsSummary } from "@/lib/public-data";
import { formatDate, formatEventWhen, splitEvents } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

interface UpdateItem {
  key: string;
  kind: "Announcement" | "News";
  title: string;
  date: string;
  href: string;
}

function StatCard({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: IconName;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon name={icon} />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </Link>
  );
}

export default async function MemberDashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const { profile } = await getMember();

  const [events, announcements, news] = await Promise.all([
    getMemberEvents().catch((): EventWithRsvp[] => []),
    getAnnouncements().catch((): AnnouncementView[] => []),
    getRecentNews(3).catch((): NewsSummary[] => []),
  ]);

  const { upcoming } = splitEvents(events);
  const registeredUpcoming = upcoming.filter((event) => event.is_registered);
  const nextRegistered = registeredUpcoming[0] ?? null;
  const unread = announcements.filter((item) => !item.is_read).length;
  const firstName = profile.full_name.split(" ")[0];
  const statusTone = profile.status === "active" ? "success" : profile.status === "pending" ? "warning" : "danger";

  const updates: UpdateItem[] = [
    ...announcements.slice(0, 3).map((item) => ({
      key: `a-${item.id}`,
      kind: "Announcement" as const,
      title: item.title,
      date: item.created_at,
      href: "/member/announcements",
    })),
    ...news.map((item) => ({
      key: `n-${item.id}`,
      kind: "News" as const,
      title: item.title,
      date: item.published_at ?? item.created_at,
      href: `/news/${item.slug}`,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {firstParam(params.error) === "forbidden" ? (
        <AuthAlert variant="warning" title="Administrator access required">
          That area is only for chapter administrators. You are signed in as a member.
        </AuthAlert>
      ) : null}

      <header>
        <h1 className="text-2xl sm:text-3xl">Welcome back, {firstName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Here is a summary of your membership and what is happening in the chapter.
        </p>
      </header>

      <section aria-labelledby="membership-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="membership-heading" className="text-lg sm:text-lg">
          Membership status
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <Badge tone={statusTone}>{STATUS_LABELS[profile.status]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</dt>
            <dd className="mt-1 text-sm font-medium">{ROLE_LABELS[profile.role]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Member ID</dt>
            <dd className="mt-1 font-mono text-sm font-medium">{profile.member_code ?? "Not yet assigned"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Member since</dt>
            <dd className="mt-1 text-sm font-medium">{profile.joined_at ? formatDate(profile.joined_at) : "Not recorded"}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Quick access" className="grid gap-4 md:grid-cols-3">
        <StatCard
          href="/member/card"
          icon="card"
          label="Member ID card"
          value={profile.member_code ?? "—"}
          hint="View or print your digital card"
        />
        <StatCard
          href="/member/events"
          icon="calendar"
          label="Upcoming events"
          value={String(upcoming.length)}
          hint={
            registeredUpcoming.length > 0
              ? `You are registered for ${registeredUpcoming.length}`
              : "You haven't registered for any yet"
          }
        />
        <StatCard
          href="/member/announcements"
          icon="bell"
          label="Unread announcements"
          value={String(unread)}
          hint={unread > 0 ? "Open to catch up" : "You are all caught up"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="next-event-heading" className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 id="next-event-heading" className="text-lg sm:text-lg">
            Your next event
          </h2>
          {nextRegistered ? (
            <div className="mt-4">
              <p className="font-semibold">
                <Link href={`/events/${nextRegistered.slug}`} className="hover:underline">
                  {nextRegistered.title}
                </Link>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatEventWhen(nextRegistered.start_time, nextRegistered.end_time)}
              </p>
              <p className="text-sm text-muted-foreground">{nextRegistered.location}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              You are not registered for an upcoming event.{" "}
              <Link href="/member/events" className="font-semibold text-primary underline-offset-4 hover:underline">
                Browse events
              </Link>
            </p>
          )}
        </section>

        <section aria-labelledby="updates-heading" className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 id="updates-heading" className="text-lg sm:text-lg">
            Recent chapter updates
          </h2>
          {updates.length > 0 ? (
            <ul className="mt-4 divide-y">
              {updates.map((item) => (
                <li key={item.key} className="py-3 first:pt-0 last:pb-0">
                  <Link href={item.href} className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.kind} · {formatDate(item.date)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No updates yet. Check back soon.</p>
          )}
        </section>
      </div>
    </div>
  );
}
