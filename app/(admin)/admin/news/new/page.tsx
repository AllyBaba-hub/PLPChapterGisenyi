import type { Metadata } from "next";
import Link from "next/link";
import { NewsForm } from "@/components/admin/NewsForm";
import { PageHeading } from "@/components/member/PageHeading";

export const metadata: Metadata = { title: "New article" };

export default function NewArticlePage() {
  return (
    <div className="space-y-6">
      <Link href="/admin/news" className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
        ← All articles
      </Link>
      <PageHeading title="New article" description="Write the article, then publish it or save it as a draft." />
      <div className="max-w-3xl rounded-xl border bg-card p-6 shadow-sm">
        <NewsForm initial={{ title: "", slug: "", excerpt: "", content: "", is_published: false, cover_url: null }} />
      </div>
    </div>
  );
}
