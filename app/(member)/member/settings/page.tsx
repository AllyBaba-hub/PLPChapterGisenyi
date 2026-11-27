import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/member/ChangePasswordForm";
import { EmailPreferenceToggle } from "@/components/member/EmailPreferenceToggle";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/labels";
import { getMember } from "@/lib/member-data";

export const metadata: Metadata = { title: "Settings" };

function formatDateTime(value: string | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Kigali" }).format(date);
}

export default async function MemberSettingsPage() {
  const { profile, user } = await getMember();

  return (
    <div className="space-y-8">
      <PageHeading title="Account settings" description="Manage notifications and the security of your account." />

      <section aria-labelledby="notifications-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="notifications-heading" className="mb-4 text-lg sm:text-lg">
          Notifications
        </h2>
        <EmailPreferenceToggle initialEnabled={profile.email_notifications} />
      </section>

      <section aria-labelledby="password-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="password-heading" className="mb-4 text-lg sm:text-lg">
          Change password
        </h2>
        <div className="max-w-md">
          <ChangePasswordForm />
        </div>
      </section>

      <section aria-labelledby="security-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="security-heading" className="mb-4 text-lg sm:text-lg">
          Account security
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sign-in email</dt>
            <dd className="mt-1 break-all text-sm font-medium">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account status</dt>
            <dd className="mt-1">
              <Badge tone={profile.status === "active" ? "success" : "warning"}>{STATUS_LABELS[profile.status]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</dt>
            <dd className="mt-1 text-sm font-medium">{ROLE_LABELS[profile.role]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account created</dt>
            <dd className="mt-1 text-sm font-medium">{formatDateTime(user.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last sign-in</dt>
            <dd className="mt-1 text-sm font-medium">{formatDateTime(user.last_sign_in_at)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Chapter leaders can see your role and status but never your password. If you notice anything unusual, change
          your password and contact the chapter.
        </p>
      </section>
    </div>
  );
}
