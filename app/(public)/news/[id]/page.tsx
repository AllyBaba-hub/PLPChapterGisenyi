import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { CoverImage } from "@/components/public/CoverImage";
import { TextContent } from "@/components/public/TextContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { getChapterSettings, getNewsByKey } from "@/lib/public-data";
import { breadcrumbNode, buildMetadata, jsonLdGraph, newsArticleNode } from "@/lib/seo";
import { formatDate, truncate } from "@/lib/utils";

export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getNewsByKey(id);
  if (!article) {
    return { title: "Article not found", robots: { index: false, follow: false } };
  }
  return buildMetadata({
    title: article.title,
    description: truncate(article.excerpt, 200),
    path: `/news/${article.slug}`,
    image: article.cover_image_url,
    type: "article",
    publishedTime: article.published_at ?? article.created_at,
    modifiedTime: article.updated_at,
  });
}

export default async function NewsArticlePage({ params }: Props) {
  const { id } = await params;
  const [article, settings] = await Promise.all([getNewsByKey(id), getChapterSettings()]);

  if (!article) notFound();
  if (id !== article.slug) permanentRedirect(`/news/${article.slug}`);

  const published = article.published_at ?? article.created_at;

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          newsArticleNode(article, settings),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "News", path: "/news" },
            { name: article.title, path: `/news/${article.slug}` },
          ])
        )}
      />

      <article className="container max-w-3xl py-10 sm:py-14">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "News", href: "/news" }, { name: article.title }]} />

        <header>
          <h1>{article.title}</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            By {settings.chapter_name} ·{" "}
            <time dateTime={published}>{formatDate(published)}</time>
          </p>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{article.excerpt}</p>
        </header>

        <CoverImage
          src={article.cover_image_url}
          alt={`Cover image for ${article.title}`}
          priority
          className="mt-8 aspect-[16/9] w-full rounded-xl border"
        />

        <TextContent text={article.content} className="mt-8" />

        <footer className="mt-12 border-t pt-6">
          <Link href="/news" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            ← Back to all news
          </Link>
        </footer>
      </article>
    </>
  );
}
