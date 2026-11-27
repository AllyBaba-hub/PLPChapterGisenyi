import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteNewsButton } from "@/components/admin/DeleteNewsButton";
import { NewsForm } from "@/components/admin/NewsForm";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { PageHeading } from "@/components/member/PageHeading";
import { buttonClass } from "@/components/ui/styles";
import { getAdmin } from "@/lib/admin-data";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit article" };

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  is_published: boolean;
}

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();

  const { supabase } = await getAdmin();
  const { data, error } = await supabase.from("news_articles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the article: ${error.message}`);
  if (!data) notFound();
  const article = data as ArticleRow;

  return (
    <div className="space-y-6">
      <Link href="/admin/news" className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
        ← All articles
      </Link>
      <PageHeading
        title={article.title}
        description="Edit this article. Changes appear on the public site within moments of saving."
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {article.is_published ? (
              <Link href={`/news/${article.slug}`} className={buttonClass("outline")} target="_blank" rel="noopener noreferrer">
                View public page
              </Link>
            ) : null}
            <PublishToggle kind="news" id={article.id} published={article.is_published} />
            <DeleteNewsButton id={article.id} title={article.title} redirectTo="/admin/news" />
          </div>
        }
      />
      <div className="max-w-3xl rounded-xl border bg-card p-6 shadow-sm">
        <NewsForm
          notice={query.created ? "Article created." : undefined}
          initial={{
            id: article.id,
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            content: article.content,
            is_published: article.is_published,
            cover_url: article.cover_image_url,
          }}
        />
      </div>
    </div>
  );
}
