import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandLogo";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { FaqSection } from "@/components/public/FaqSection";
import { PageIntro } from "@/components/public/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { buttonClass } from "@/components/ui/styles";
import { CHAPTER_VALUES, getAboutFaqs } from "@/lib/content";
import { getChapterSettings } from "@/lib/public-data";
import { breadcrumbNode, buildMetadata, faqNode, jsonLdGraph, organizationNode, pageNode } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getChapterSettings();
  return buildMetadata({
    title: "About PLP Chapter Gisenyi",
    description: `${settings.chapter_name} is a decentralized chapter of ${settings.parent_organization} serving youth in ${settings.district_location}. Learn about our mission and how to get involved.`,
    path: "/about",
  });
}

export default async function AboutPage() {
  const settings = await getChapterSettings();
  const faqs = getAboutFaqs(settings);

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationNode(settings),
          pageNode({
            type: "AboutPage",
            name: `About ${settings.chapter_name}`,
            description: settings.about_summary,
            path: "/about",
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          faqNode(faqs)
        )}
      />

      <PageIntro title={`About ${settings.chapter_name}`} description={settings.about_summary}>
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "About" }]} />
      </PageIntro>

      <section aria-labelledby="who-heading" className="container grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="max-w-3xl space-y-4 text-base leading-7">
          <h2 id="who-heading">Who we are</h2>
          <p>
            {settings.chapter_name} is a decentralized district chapter of {settings.parent_organization}, a
            youth-led organization founded in Rwanda in 2007. The chapter works in {settings.district_location}
            {" "}to bring young people together around peace, unity and community service.
          </p>
          <p>
            As a local chapter we have our own home for sharing news and events, keeping a photo and video
            record of our activities, welcoming new members and keeping members informed.
          </p>
        </div>
        <div className="hidden lg:block">
          <BrandMark size={120} />
        </div>
      </section>

      <section aria-labelledby="mission-heading" className="border-y bg-secondary/40">
        <div className="container py-12 sm:py-16">
          <h2 id="mission-heading">Our mission and values</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            We empower youth in Rubavu District through peacebuilding, unity, reconciliation and community
            service.
          </p>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CHAPTER_VALUES.map((value) => (
              <li key={value.title} className="rounded-xl border bg-card p-6 shadow-sm">
                <h3 className="text-lg sm:text-lg">{value.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{value.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="involved-heading" className="container py-12 sm:py-16">
        <h2 id="involved-heading">Get involved</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="text-lg sm:text-lg">Follow our activities</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              See what the chapter is doing in the news, events and gallery sections.
            </p>
            <Link href="/events" className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Browse events
            </Link>
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="text-lg sm:text-lg">Become a member</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Apply online to join, register for events and receive chapter announcements.
            </p>
            <Link href="/join" className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Apply to join
            </Link>
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="text-lg sm:text-lg">Talk to us</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Questions, partnerships or ideas? Chapter leaders would like to hear from you.
            </p>
            <Link href="/contact" className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Contact the chapter
            </Link>
          </div>
        </div>
      </section>

      <FaqSection faqs={faqs} headingId="about-faq-heading" />

      <section className="container pb-16 text-center">
        <Link href="/join" className={buttonClass("primary", "lg")}>
          Join {settings.chapter_name}
        </Link>
      </section>
    </>
  );
}
