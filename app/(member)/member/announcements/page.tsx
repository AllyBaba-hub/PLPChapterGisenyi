import type { Metadata } from "next";
import { AnnouncementList } from "@/components/member/AnnouncementList";
import { PageHeading } from "@/components/member/PageHeading";
import { getAnnouncements } from "@/lib/member-data";

export const metadata: Metadata = { title: "Announcements" };

export default async function MemberAnnouncementsPage() {
  const announcements = await getAnnouncements();

  return (
    <div>
      <PageHeading
        title="Chapter announcements"
        description="Notices from chapter leadership. Urgent and important items come first. Opening or seeing an announcement marks it as read."
      />
      {announcements.length > 0 ? (
        <AnnouncementList items={announcements} />
      ) : (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          There are no announcements right now.
        </p>
      )}
    </div>
  );
}
