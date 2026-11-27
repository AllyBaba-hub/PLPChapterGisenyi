import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandLogo";
import { CoverImage } from "@/components/public/CoverImage";
import { EventCard } from "@/components/public/EventCard";
import { FaqSection } from "@/components/public/FaqSection";
import { NewsCard } from "@/components/public/NewsCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { buttonClass } from "@/components/ui/styles";
import { CHAPTER_VALUES, getHomeFaqs } from "@/lib/content";
import { getChapterSettings, getGalleryItems, getPublishedEvents, getPublishedNews } from "@/lib/public-data";
import { buildMetadata, faqNode, jsonLdGraph, organizationNode, pageNode, websiteNode } from "@/lib/seo";
import { formatEventWhen, splitEvents } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getChapterSettings();
  return buildMetadata({
    title: "PLP Chapter Gisenyi | Peace and Love Proclaimers in Gisenyi, Rubavu",
    description: settings.about_summary,
    path: "/",
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const [settings, events, news, gallery] = await Promise.all([
    getChapterSettings(),
    getPublishedEvents(60),
    getPublishedNews(3),
    getGalleryItems(12),
  ]);

  const { upcoming } = splitEvents(events);
  const nextEvent = upcoming[0] ?? null;
  const photos = gallery.filter((item) => item.media_type === "photo").slice(0, 4);
  const faqs = getHomeFaqs(settings);

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationNode(settings),
          websiteNode(settings),
          pageNode({ name: settings.chapter_name, description: settings.about_summary, path: "/" }),
          faqNode(faqs)
        )}
      />

      <section aria-labelledby="hero-heading" className="border-b bg-secondary/50">
        <div className="container grid gap-10 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-semibold text-primary">
              A chapter of {settings.parent_organization}
            </p>
            <h1 id="hero-heading" className="mt-3">
              {settings.chapter_name}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">{settings.about_summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/join" className={buttonClass("primary", "lg")}>
                Join the chapter
              </Link>
              <Link href="/events" className={buttonClass("outline", "lg")}>
                See upcoming events
              </Link>
            </div>
          </div>

          <aside aria-label="Next event" className="rounded-xl border bg-card p-6 shadow-sm">
            {nextEvent ? (
              <>
                <p className="text-sm font-semibold text-primary">Next event</p>
                <h2 className="mt-2 text-2xl">
                  <Link href={`/events/${nextEvent.slug}`} className="hover:underline">
                    {nextEvent.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatEventWhen(nextEvent.start_time, nextEvent.end_time)}
                </p>
                <p className="text-sm text-muted-foreground">{nextEvent.location}</p>
                <Link
                  href={`/events/${nextEvent.slug}`}
                  className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  View event details
                </Link>
              </>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <BrandMark size={56} />
                <div>
                  <p className="font-semibold">No events scheduled right now</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New activities are announced here and by email to members.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section aria-labelledby="values-heading" className="container py-12 sm:py-16">
        <h2 id="values-heading">What we stand for</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CHAPTER_VALUES.map((value) => (
            <li key={value.title} className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="text-lg sm:text-lg">{value.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{value.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="events-heading" className="border-y bg-secondary/40">
        <div className="container py-12 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <h2 id="events-heading">Upcoming events</h2>
            <Link href="/events" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              All events
            </Link>
          </div>
          {upcoming.length > 0 ? (
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.slice(0, 3).map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              No upcoming events are published yet. Check back soon.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="news-heading" className="container py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 id="news-heading">Latest news</h2>
          <Link href="/news" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            All news
          </Link>
        </div>
        {news.length > 0 ? (
          <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {news.map((article) => (
              <li key={article.id}>
                <NewsCard article={article} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No news has been published yet.
          </p>
        )}
      </section>

      {photos.length > 0 ? (
        <section aria-labelledby="gallery-heading" className="border-y bg-secondary/40">
          <div className="container py-12 sm:py-16">
            <div className="flex items-end justify-between gap-4">
              <h2 id="gallery-heading">From our gallery</h2>
              <Link href="/gallery" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                Full gallery
              </Link>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <Link href="/gallery" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <CoverImage src={photo.media_url} alt={photo.alt_text} className="aspect-square w-full" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <FaqSection faqs={faqs} headingId="faq-heading" />

      <section aria-labelledby="cta-heading" className="container pb-16">
        <div className="rounded-xl bg-primary px-6 py-10 text-center text-primary-foreground sm:px-12">
          <h2 id="cta-heading" className="text-primary-foreground">
            Become part of {settings.chapter_name}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
            Apply online, take part in chapter activities and get your digital membership card.
          </p>
          <Link
            href="/join"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-background px-6 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            Apply to join
          </Link>
        </div>
      </section>
    </>
  );
}
