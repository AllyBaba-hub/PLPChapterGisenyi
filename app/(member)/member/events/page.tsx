import type { Metadata } from "next";
import { MemberEventCard } from "@/components/member/MemberEventCard";
import { PageHeading } from "@/components/member/PageHeading";
import { getMemberEvents } from "@/lib/member-data";
import { splitEvents } from "@/lib/utils";

export const metadata: Metadata = { title: "Events" };

export default async function MemberEventsPage() {
  const events = await getMemberEvents();
  const { upcoming, past } = splitEvents(events);

  return (
    <div className="space-y-10">
      <PageHeading
        title="Chapter events"
        description="Register for upcoming activities with one click. You can cancel any time before an event starts."
      />

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-xl sm:text-xl">
          Upcoming events
        </h2>
        {upcoming.length > 0 ? (
          <ul className="mt-5 grid gap-6 md:grid-cols-2">
            {upcoming.map((event) => (
              <li key={event.id}>
                <MemberEventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            There are no upcoming events right now. New activities appear here as soon as they are published.
          </p>
        )}
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="text-xl sm:text-xl">
            Past events
          </h2>
          <ul className="mt-5 grid gap-6 md:grid-cols-2">
            {past.slice(0, 12).map((event) => (
              <li key={event.id}>
                <MemberEventCard event={event} past />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
