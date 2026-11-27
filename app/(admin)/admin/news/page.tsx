import type { Metadata } from "next";
import Link from "next/link";
import { DeleteNewsButton } from "@/components/admin/DeleteNewsButton";
import { Pagination } from "@/components/admin/Pagination";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { Icon } from "@/components/member/icons";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/styles";
import { getAdmin } from "@/lib/admin-data";
import { pageParam, pageRange, totalPages, PAGE_SIZE, type SearchParams } from "@/lib/admin-query";
import { formatDate, truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "News" };

interface Row {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

export default async function AdminNewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase } = await getAdmin();
  const page = pageParam(params);
  const { from, to } = pageRange(page);

  const { data, count, error } = await supabase
    .from("news_articles")
    .select("id, slug, title, excerpt, is_published, published_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(`Could not load articles: ${error.message}`);
  const rows = (data ?? []) as Row[];

  return (
    <div>
      <PageHeading
        title="News"
        description="Write and publish chapter news for the public website."
        actions={
          <Link href="/admin/news/new" className={buttonClass("primary")}>
            <Icon name="plus" className="h-4 w-4" />
            New article
          </Link>
        }
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No articles yet. Write the first one.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((article) => (
            <li key={article.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={article.is_published ? "success" : "muted"}>{article.is_published ? "Published" : "Draft"}</Badge>
                <span className="text-xs text-muted-foreground">
                  {article.is_published && article.published_at ? `Published ${formatDate(article.published_at)}` : `Created ${formatDate(article.created_at)}`}
                </span>
              </div>
              <h2 className="mt-2 text-lg sm:text-lg">{article.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{truncate(article.excerpt, 200)}</p>
              <div className="mt-4 flex flex-wrap items-start gap-2 border-t pt-4">
                <Link href={`/admin/news/${article.id}/edit`} className={buttonClass("outline")}>
                  <Icon name="pencil" className="h-4 w-4" />
                  Edit
                </Link>
                {article.is_published ? (
                  <Link href={`/news/${article.slug}`} className={buttonClass("outline")} target="_blank" rel="noopener noreferrer">
                    View
                  </Link>
                ) : null}
                <PublishToggle kind="news" id={article.id} published={article.is_published} />
                <DeleteNewsButton id={article.id} title={article.title} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages(count ?? 0, PAGE_SIZE)} basePath="/admin/news" />
    </div>
  );
}
