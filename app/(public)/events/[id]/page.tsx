import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { CoverImage } from "@/components/public/CoverImage";
import { TextContent } from "@/components/public/TextContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { buttonClass } from "@/components/ui/styles";
import { getChapterSettings, getEventByKey } from "@/lib/public-data";
import { breadcrumbNode, buildMetadata, eventNode, jsonLdGraph } from "@/lib/seo";
import { eventEndsAt, formatEventWhen, truncate } from "@/lib/utils";

export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventByKey(id);
  if (!event) {
    return { title: "Event not found", robots: { index: false, follow: false } };
  }
  return buildMetadata({
    title: event.title,
    description: truncate(`${event.summary} ${event.location}.`, 200),
    path: `/events/${event.slug}`,
    image: event.cover_image_url,
  });
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const [event, settings] = await Promise.all([getEventByKey(id), getChapterSettings()]);

  if (!event) notFound();
  if (id !== event.slug) permanentRedirect(`/events/${event.slug}`);

  const ended = eventEndsAt(event) < new Date();

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          eventNode(event, settings),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
            { name: event.title, path: `/events/${event.slug}` },
          ])
        )}
      />

      <article className="container max-w-4xl py-10 sm:py-14">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Events", href: "/events" }, { name: event.title }]} />

        <header>
          {ended ? (
            <p className="mb-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
              This event has ended
            </p>
          ) : null}
          <h1>{event.title}</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{event.summary}</p>
        </header>

        <CoverImage
          src={event.cover_image_url}
          alt={`Cover image for ${event.title}`}
          priority
          className="mt-8 aspect-[16/9] w-full rounded-xl border"
        />

        <dl className="mt-8 grid gap-4 rounded-xl border bg-card p-6 shadow-sm sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold">When</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              <time dateTime={event.start_time}>{formatEventWhen(event.start_time, event.end_time)}</time>
              <span className="block text-xs">Rwanda time (CAT)</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">Where</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{event.location}</dd>
          </div>
          {event.max_capacity ? (
            <div>
              <dt className="text-sm font-semibold">Capacity</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{event.max_capacity} places</dd>
            </div>
          ) : null}
        </dl>

        <section aria-labelledby="about-event-heading" className="mt-10">
          <h2 id="about-event-heading">About this event</h2>
          <TextContent text={event.description} className="mt-4" />
        </section>

        <aside aria-labelledby="register-heading" className="mt-10 rounded-xl bg-accent p-6">
          <h2 id="register-heading" className="text-xl text-accent-foreground sm:text-xl">
            {ended ? "See more from the chapter" : "Take part"}
          </h2>
          {ended ? (
            <>
              <p className="mt-2 text-sm text-accent-foreground/90">
                Look through the gallery or find the next activity.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/gallery" className={buttonClass("primary")}>
                  Open the gallery
                </Link>
                <Link href="/events" className={buttonClass("outline")}>
                  Upcoming events
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-accent-foreground/90">
                Chapter members register for events in the member portal. Not a member yet? Apply to join
                first.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/login?next=${encodeURIComponent("/member/events")}`} className={buttonClass("primary")}>
                  Sign in to register
                </Link>
                <Link href="/join" className={buttonClass("outline")}>
                  Apply to join
                </Link>
              </div>
            </>
          )}
        </aside>
      </article>
    </>
  );
}
