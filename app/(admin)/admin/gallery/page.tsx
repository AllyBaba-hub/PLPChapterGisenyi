import type { Metadata } from "next";
import { GalleryItemCard, type GalleryRow } from "@/components/admin/GalleryItemCard";
import { GalleryUploadForm } from "@/components/admin/GalleryUploadForm";
import { Pagination } from "@/components/admin/Pagination";
import { PageHeading } from "@/components/member/PageHeading";
import { getAdmin } from "@/lib/admin-data";
import { pageParam, pageRange, totalPages, type SearchParams } from "@/lib/admin-query";

export const metadata: Metadata = { title: "Gallery" };

const GALLERY_PAGE_SIZE = 24;

export default async function AdminGalleryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase } = await getAdmin();
  const page = pageParam(params);
  const { from, to } = pageRange(page, GALLERY_PAGE_SIZE);

  const [items, events] = await Promise.all([
    supabase
      .from("gallery_items")
      .select("id, title, caption, alt_text, media_type, media_url, event_id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase.from("events").select("id, title").order("start_time", { ascending: false }).limit(100),
  ]);

  if (items.error) throw new Error(`Could not load the gallery: ${items.error.message}`);
  const rows = (items.data ?? []) as GalleryRow[];
  const eventOptions = (events.data ?? []) as Array<{ id: string; title: string }>;

  return (
    <div className="space-y-8">
      <PageHeading
        title="Gallery"
        description="Upload compressed photos or link YouTube videos. Videos are never stored here, only their links."
      />

      <section aria-labelledby="add-heading" className="max-w-3xl rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="add-heading" className="mb-4 text-lg sm:text-lg">
          Add to the gallery
        </h2>
        <GalleryUploadForm events={eventOptions} />
      </section>

      <section aria-labelledby="items-heading">
        <h2 id="items-heading" className="mb-4 text-lg sm:text-lg">
          Gallery items ({items.count ?? 0})
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">The gallery is empty.</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((item) => (
              <GalleryItemCard key={item.id} item={item} events={eventOptions} />
            ))}
          </ul>
        )}
        <Pagination page={page} totalPages={totalPages(items.count ?? 0, GALLERY_PAGE_SIZE)} basePath="/admin/gallery" />
      </section>
    </div>
  );
}
