import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/public-data";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

const STATIC_PAGES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/events", priority: 0.9, changeFrequency: "weekly" },
  { path: "/news", priority: 0.9, changeFrequency: "weekly" },
  { path: "/gallery", priority: 0.7, changeFrequency: "weekly" },
  { path: "/join", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { events, news } = await getSitemapEntries();

  return [
    ...STATIC_PAGES.map((page) => ({
      url: absoluteUrl(page.path),
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...events.map((event) => ({
      url: absoluteUrl(`/events/${event.slug}`),
      lastModified: new Date(event.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...news.map((article) => ({
      url: absoluteUrl(`/news/${article.slug}`),
      lastModified: new Date(article.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
