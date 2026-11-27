import type { Metadata } from "next";
import { AnnouncementManager, type AnnouncementRow } from "@/components/admin/AnnouncementManager";
import { PageHeading } from "@/components/member/PageHeading";
import { getAdmin } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage() {
  const { supabase } = await getAdmin();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, priority, is_published, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load announcements: ${error.message}`);

  return (
    <div>
      <PageHeading
        title="Announcements"
        description="Notices shown to active members in their portal. Optionally email them too."
      />
      <AnnouncementManager items={(data ?? []) as AnnouncementRow[]} />
    </div>
  );
}
