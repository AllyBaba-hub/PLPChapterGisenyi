import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge } from "@/components/ui/Badge";
import { getAdmin, getAdminSettings, getEmailUsage } from "@/lib/admin-data";
import { EMAILJS_MAX_BCC_PER_REQUEST, EMAILJS_MONTHLY_LIMIT, EMAILJS_MIN_INTERVAL_MS, isEmailJsConfigured } from "@/lib/emailjs";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const { supabase } = await getAdmin();
  const [settings, usage] = await Promise.all([getAdminSettings(), getEmailUsage(supabase)]);
  const percent = Math.min(100, Math.round((usage / EMAILJS_MONTHLY_LIMIT) * 100));

  return (
    <div className="space-y-8">
      <PageHeading title="Chapter settings" description="Identity, contact details and preferences used across the public site and member portal." />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-labelledby="settings-heading" className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 id="settings-heading" className="sr-only">
            Chapter settings form
          </h2>
          <SettingsForm
            initial={{
              chapter_name: settings.chapter_name,
              parent_organization: settings.parent_organization,
              district_location: settings.district_location,
              contact_email: settings.contact_email,
              contact_phone: settings.contact_phone ?? "",
              about_summary: settings.about_summary,
              applications_open: settings.applications_open,
              auto_email_notifications: settings.auto_email_notifications,
              social_links: settings.social_links,
            }}
          />
        </section>

        <aside aria-labelledby="email-heading" className="h-fit space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <h2 id="email-heading" className="text-lg sm:text-lg">
            Email &amp; free-tier usage
          </h2>

          <div>
            <p className="text-sm font-medium">EmailJS requests this month</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {usage} <span className="text-base font-medium text-muted-foreground">/ {EMAILJS_MONTHLY_LIMIT}</span>
            </p>
            <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div className={percent >= 90 ? "h-full bg-destructive" : percent >= 70 ? "h-full bg-warning" : "h-full bg-primary"} style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Counted from emails sent through this admin area. Your EmailJS dashboard is the source of truth.
            </p>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt>Activity alert template</dt>
              <dd>
                <Badge tone={isEmailJsConfigured("activity") ? "success" : "warning"}>
                  {isEmailJsConfigured("activity") ? "Configured" : "Not configured"}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Account notice template</dt>
              <dd>
                <Badge tone={isEmailJsConfigured("account") ? "success" : "warning"}>
                  {isEmailJsConfigured("account") ? "Configured" : "Not configured"}
                </Badge>
              </dd>
            </div>
          </dl>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold tracking-tight sm:text-sm">Staying inside the free tier</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>The free plan allows {EMAILJS_MONTHLY_LIMIT} requests a month, 2 templates and 1 request per second.</li>
              <li>Activity alerts are sent as BCC batches of up to {EMAILJS_MAX_BCC_PER_REQUEST} members, so one alert usually costs one request.</li>
              <li>Account notices (approvals, suspensions, role changes) cost one request each. Switch them off per action when they aren&apos;t needed.</li>
              <li>Requests are spaced {EMAILJS_MIN_INTERVAL_MS / 1000} seconds apart. Alerts stop before the monthly limit, keeping a reserve for approvals.</li>
              <li>Members who switch off email alerts in their settings are never emailed.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
