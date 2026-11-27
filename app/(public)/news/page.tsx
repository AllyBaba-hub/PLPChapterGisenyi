import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { NewsCard } from "@/components/public/NewsCard";
import { PageIntro } from "@/components/public/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { getChapterSettings, getPublishedNews } from "@/lib/public-data";
import { absoluteUrl, breadcrumbNode, buildMetadata, jsonLdGraph, organizationNode, pageNode } from "@/lib/seo";

export const revalidate = 300;

const DESCRIPTION =
  "News and updates from PLP Chapter Gisenyi: activities, announcements and stories from youth working for peace and unity in Rubavu District.";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: "News", description: DESCRIPTION, path: "/news" });
}

export default async function NewsPage() {
  const [settings, articles] = await Promise.all([getChapterSettings(), getPublishedNews(30)]);

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationNode(settings),
          pageNode({
            type: "CollectionPage",
            name: `${settings.chapter_name} news`,
            description: DESCRIPTION,
            path: "/news",
            items: articles.map((article) => ({
              url: absoluteUrl(`/news/${article.slug}`),
              name: article.title,
            })),
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "News", path: "/news" },
          ])
        )}
      />

      <PageIntro title="News" description="Updates and stories from the chapter.">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "News" }]} />
      </PageIntro>

      <section aria-label="News articles" className="container py-12 sm:py-16">
        {articles.length > 0 ? (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.id}>
                <NewsCard article={article} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No news has been published yet. Please check back soon.
          </p>
        )}
      </section>
    </>
  );
}
