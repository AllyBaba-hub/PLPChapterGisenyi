"use server";

import { revalidatePath } from "next/cache";
import {
  adminAudit,
  clean,
  dbMessage,
  fail,
  getAdminContext,
  revalidateAdmin,
  revalidatePublic,
  uniqueSlug,
  type ActionResult,
} from "@/lib/admin-actions";
import { isAdminImagePath, MEDIA_BUCKET, storagePathFromPublicUrl } from "@/lib/storage";
import { isUuid } from "@/lib/utils";

export interface NewsInput {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  is_published: boolean;
  cover: { action: "keep" | "remove" | "set"; path?: string };
}

type Supabase = Parameters<typeof adminAudit>[0]["supabase"];

interface ExistingArticle {
  slug: string;
  cover_image_url: string | null;
  is_published: boolean;
  published_at: string | null;
}

async function removeStoredImage(supabase: Supabase, url: string | null | undefined): Promise<void> {
  const path = storagePathFromPublicUrl(url);
  if (!path || !path.startsWith("news/")) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) console.error("[admin/news] storage cleanup:", error.message);
}

function revalidateNewsPages(...slugs: Array<string | undefined>): void {
  revalidatePublic(slugs.filter((slug): slug is string => Boolean(slug)).map((slug) => `/news/${slug}`));
  revalidatePath("/member", "layout");
  revalidateAdmin("/admin/news");
}

export async function saveNews(input: NewsInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  const id = input.id && isUuid(input.id) ? input.id : undefined;
  if (input.id && !id) return fail("Invalid request.");

  const values = {
    title: clean(input.title, 150),
    excerpt: clean(input.excerpt, 300),
    content: clean(input.content, 20000, true),
  };
  const fieldErrors: Record<string, string> = {};
  if (values.title.length < 3) fieldErrors.title = "Enter a headline (at least 3 characters).";
  if (values.excerpt.length < 10) fieldErrors.excerpt = "Write a short summary (at least 10 characters).";
  if (values.content.length < 30) fieldErrors.content = "Write the article (at least 30 characters).";
  if (Object.keys(fieldErrors).length > 0) return fail("Please fix the highlighted fields.", fieldErrors);

  let existing: ExistingArticle | null = null;
  if (id) {
    const { data } = await ctx.supabase
      .from("news_articles")
      .select("slug, cover_image_url, is_published, published_at")
      .eq("id", id)
      .maybeSingle();
    existing = data as ExistingArticle | null;
    if (!existing) return fail("We couldn't find that article.");
  }

  if (input.cover.action === "set" && !isAdminImagePath(input.cover.path, "news")) {
    return fail("That cover image upload isn't valid. Please choose the image again.");
  }

  const slug = await uniqueSlug(ctx.supabase, "news_articles", clean(input.slug, 80) || values.title, id);
  const published = Boolean(input.is_published);

  let coverUrl: string | null | undefined;
  if (input.cover.action === "set" && input.cover.path) {
    coverUrl = ctx.supabase.storage.from(MEDIA_BUCKET).getPublicUrl(input.cover.path).data.publicUrl;
  } else if (input.cover.action === "remove") {
    coverUrl = null;
  }

  const record = {
    ...values,
    slug,
    is_published: published,
    published_at: published ? (existing?.published_at ?? new Date().toISOString()) : (existing?.published_at ?? null),
    ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
  };

  const query = id
    ? ctx.supabase.from("news_articles").update(record).eq("id", id)
    : ctx.supabase.from("news_articles").insert({ ...record, author_id: ctx.user.id });
  const { data, error } = await query.select("id, slug").single();

  if (error || !data) {
    console.error("[admin/news] save:", error?.message);
    if (input.cover.action === "set" && input.cover.path) {
      await ctx.supabase.storage.from(MEDIA_BUCKET).remove([input.cover.path]);
    }
    return fail(error ? dbMessage(error, "We couldn't save this article. Please try again.") : "We couldn't save this article.");
  }

  if (existing && coverUrl !== undefined && existing.cover_image_url && existing.cover_image_url !== coverUrl) {
    await removeStoredImage(ctx.supabase, existing.cover_image_url);
  }

  const saved = data as { id: string; slug: string };
  await adminAudit(ctx, id ? "NEWS_UPDATED" : "NEWS_CREATED", "news", saved.id, { title: values.title, published });
  revalidateNewsPages(saved.slug, existing?.slug);

  return { ok: true, message: id ? "Article saved." : "Article created.", data: saved };
}

export async function setNewsPublished(id: string, published: boolean): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id) || typeof published !== "boolean") return fail("Invalid request.");

  const { data: current } = await ctx.supabase.from("news_articles").select("published_at").eq("id", id).maybeSingle();
  if (!current) return fail("We couldn't find that article.");

  const { data, error } = await ctx.supabase
    .from("news_articles")
    .update({
      is_published: published,
      ...(published && !(current as { published_at: string | null }).published_at
        ? { published_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", id)
    .select("slug, title")
    .maybeSingle();

  if (error || !data) {
    console.error("[admin/news] publish:", error?.message);
    return fail("We couldn't update that article. Please try again.");
  }

  const row = data as { slug: string; title: string };
  await adminAudit(ctx, published ? "NEWS_PUBLISHED" : "NEWS_UNPUBLISHED", "news", id, { title: row.title });
  revalidateNewsPages(row.slug);
  return { ok: true, message: published ? "Article published." : "Article unpublished." };
}

export async function deleteNews(id: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const { data: article } = await ctx.supabase
    .from("news_articles")
    .select("slug, title, cover_image_url")
    .eq("id", id)
    .maybeSingle();
  if (!article) return fail("We couldn't find that article.");
  const row = article as { slug: string; title: string; cover_image_url: string | null };

  const { error } = await ctx.supabase.from("news_articles").delete().eq("id", id);
  if (error) {
    console.error("[admin/news] delete:", error.message);
    return fail("We couldn't delete that article. Please try again.");
  }

  await removeStoredImage(ctx.supabase, row.cover_image_url);
  await adminAudit(ctx, "NEWS_DELETED", "news", id, { title: row.title });
  revalidateNewsPages(row.slug);
  return { ok: true, message: "Article deleted." };
}
