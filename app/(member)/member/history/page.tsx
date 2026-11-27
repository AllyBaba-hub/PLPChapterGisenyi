import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { getMemberRegistrations, type RegistrationRecord } from "@/lib/member-data";
import { eventEndsAt, formatDate, formatEventWhen } from "@/lib/utils";

export const metadata: Metadata = { title: "My history" };

function SummaryTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function HistoryRow({ record, now }: { record: RegistrationRecord; now: Date }) {
  const ended = eventEndsAt(record.event) < now;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="font-semibold">
          <Link href={`/events/${record.event.slug}`} className="hover:underline">
            {record.event.title}
          </Link>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatEventWhen(record.event.start_time, record.event.end_time)}
        </p>
        <p className="text-sm text-muted-foreground">{record.event.location}</p>
        <p className="mt-1 text-xs text-muted-foreground">Registered on {formatDate(record.registered_at)}</p>
      </div>
      {!ended ? (
        <Badge tone="primary">Registered</Badge>
      ) : record.attended ? (
        <Badge tone="success">Attended</Badge>
      ) : (
        <Badge tone="muted">Attendance not recorded</Badge>
      )}
    </li>
  );
}

export default async function MemberHistoryPage() {
  const records = await getMemberRegistrations();
  const now = new Date();

  const upcoming = records
    .filter((record) => eventEndsAt(record.event) >= now)
    .sort((a, b) => a.event.start_time.localeCompare(b.event.start_time));
  const past = records
    .filter((record) => eventEndsAt(record.event) < now)
    .sort((a, b) => b.event.start_time.localeCompare(a.event.start_time));
  const attended = past.filter((record) => record.attended).length;
  const rate = past.length > 0 ? Math.round((attended / past.length) * 100) : null;

  return (
    <div className="space-y-8">
      <PageHeading
        title="Participation history"
        description="The chapter events you have registered for and attended."
      />

      <section aria-label="Participation summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Registered" value={String(records.length)} hint="All events" />
        <SummaryTile label="Attended" value={String(attended)} hint="Marked by chapter leaders" />
        <SummaryTile label="Upcoming" value={String(upcoming.length)} />
        <SummaryTile
          label="Attendance rate"
          value={rate === null ? "—" : `${rate}%`}
          hint={past.length > 0 ? `${attended} of ${past.length} past events` : "No past events yet"}
        />
      </section>

      {records.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          You haven&apos;t registered for any events yet.{" "}
          <Link href="/member/events" className="font-semibold text-primary underline-offset-4 hover:underline">
            Browse upcoming events
          </Link>
        </p>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section aria-labelledby="upcoming-heading" className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 id="upcoming-heading" className="text-lg sm:text-lg">
                Upcoming
              </h2>
              <ul className="mt-2 divide-y">
                {upcoming.map((record) => (
                  <HistoryRow key={record.id} record={record} now={now} />
                ))}
              </ul>
            </section>
          ) : null}

          {past.length > 0 ? (
            <section aria-labelledby="past-heading" className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 id="past-heading" className="text-lg sm:text-lg">
                Past events
              </h2>
              <ul className="mt-2 divide-y">
                {past.map((record) => (
                  <HistoryRow key={record.id} record={record} now={now} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
