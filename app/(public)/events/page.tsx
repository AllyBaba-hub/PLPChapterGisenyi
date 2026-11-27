import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { EventCard } from "@/components/public/EventCard";
import { PageIntro } from "@/components/public/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { getChapterSettings, getPublishedEvents } from "@/lib/public-data";
import { absoluteUrl, breadcrumbNode, buildMetadata, jsonLdGraph, organizationNode, pageNode } from "@/lib/seo";
import { splitEvents } from "@/lib/utils";

export const revalidate = 300;

const DESCRIPTION =
  "Upcoming and past activities of PLP Chapter Gisenyi in Rubavu District: peacebuilding, unity, reconciliation and youth leadership events.";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: "Events", description: DESCRIPTION, path: "/events" });
}

export default async function EventsPage() {
  const [settings, events] = await Promise.all([getChapterSettings(), getPublishedEvents(60)]);
  const { upcoming, past } = splitEvents(events);

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationNode(settings),
          pageNode({
            type: "CollectionPage",
            name: `${settings.chapter_name} events`,
            description: DESCRIPTION,
            path: "/events",
            items: events.slice(0, 30).map((event) => ({
              url: absoluteUrl(`/events/${event.slug}`),
              name: event.title,
            })),
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
          ])
        )}
      />

      <PageIntro title="Events" description="Join us at our next activity, or look back at what the chapter has done.">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Events" }]} />
      </PageIntro>

      <section aria-labelledby="upcoming-heading" className="container py-12 sm:py-16">
        <h2 id="upcoming-heading">Upcoming events</h2>
        {upcoming.length > 0 ? (
          <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No upcoming events are published right now. New activities are announced here first.
          </p>
        )}
      </section>

      {past.length > 0 ? (
        <section aria-labelledby="past-heading" className="border-t bg-secondary/40">
          <div className="container py-12 sm:py-16">
            <h2 id="past-heading">Past events</h2>
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {past.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} past />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
