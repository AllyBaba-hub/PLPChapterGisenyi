import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdmin, getAdminCounts } from "@/lib/admin-data";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Second line of defence after middleware: only active admins and super admins get past this.
  const { profile } = await getAdmin();
  const counts = await getAdminCounts();

  return (
    <AdminShell
      counts={{ applications: counts.pendingApplications, messages: counts.unreadMessages }}
      profile={{
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role_label: ROLE_LABELS[profile.role],
      }}
    >
      {children}
    </AdminShell>
  );
}
