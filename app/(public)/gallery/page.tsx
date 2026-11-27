import type { Metadata } from "next";
import { GalleryBrowser, type GalleryItemView } from "@/components/public/GalleryBrowser";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { PageIntro } from "@/components/public/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { getChapterSettings, getGalleryItems } from "@/lib/public-data";
import { breadcrumbNode, buildMetadata, jsonLdGraph, organizationNode, pageNode } from "@/lib/seo";
import { parseYouTubeId } from "@/lib/youtube";

export const revalidate = 300;

const DESCRIPTION =
  "Photos and videos from PLP Chapter Gisenyi activities and events in Gisenyi, Rubavu District, Rwanda.";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: "Photo and video gallery", description: DESCRIPTION, path: "/gallery" });
}

export default async function GalleryPage() {
  const [settings, items] = await Promise.all([getChapterSettings(), getGalleryItems(60)]);

  const views: GalleryItemView[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    caption: item.caption,
    alt: item.alt_text,
    type: item.media_type,
    url: item.media_url,
    videoId: item.media_type === "video" ? parseYouTubeId(item.media_url) : null,
    eventTitle: item.event?.title ?? null,
    eventSlug: item.event?.slug ?? null,
  }));

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationNode(settings),
          pageNode({
            type: "CollectionPage",
            name: `${settings.chapter_name} gallery`,
            description: DESCRIPTION,
            path: "/gallery",
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Gallery", path: "/gallery" },
          ])
        )}
      />

      <PageIntro title="Gallery" description="Moments from our events and community activities.">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Gallery" }]} />
      </PageIntro>

      <section aria-label="Photos and videos" className="container py-12 sm:py-16">
        {views.length > 0 ? (
          <GalleryBrowser items={views} />
        ) : (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Photos and videos will appear here after our next activities.
          </p>
        )}
      </section>
    </>
  );
}
