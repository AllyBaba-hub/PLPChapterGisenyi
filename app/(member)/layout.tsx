import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MemberShell } from "@/components/member/MemberShell";
import { ROLE_LABELS } from "@/lib/labels";
import { getMember, getUnreadAnnouncementCount } from "@/lib/member-data";

export const metadata: Metadata = {
  title: { default: "Member portal", template: "%s | Member portal" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function MemberLayout({ children }: { children: ReactNode }) {
  // Second line of defence after middleware: redirects anonymous, pending and suspended users.
  const { profile } = await getMember();
  const unreadCount = await getUnreadAnnouncementCount();

  return (
    <MemberShell
      unreadCount={unreadCount}
      profile={{
        full_name: profile.full_name,
        member_code: profile.member_code,
        avatar_url: profile.avatar_url,
        role_label: ROLE_LABELS[profile.role],
      }}
    >
      {children}
    </MemberShell>
  );
}
