import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplicationReviewActions } from "@/components/admin/ApplicationReviewActions";
import { AuthAlert } from "@/components/auth/ui";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { getAdmin, getAdminSettings } from "@/lib/admin-data";
import { formatDate, isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Review application" };

const TONES: Record<string, BadgeTone> = { pending: "warning", approved: "success", rejected: "danger" };

interface Application {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  gender: string | null;
  sector_or_cell: string;
  school_or_occupation: string | null;
  motivation: string;
  skills_or_interests: string | null;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm">{value || "Not provided"}</dd>
    </div>
  );
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { supabase } = await getAdmin();
  const [{ data, error }, settings] = await Promise.all([
    supabase.from("membership_applications").select("*").eq("id", id).maybeSingle(),
    getAdminSettings(),
  ]);
  if (error) throw new Error(`Could not load the application: ${error.message}`);
  if (!data) notFound();
  const application = data as Application;

  let reviewer: string | null = null;
  if (application.reviewed_by) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", application.reviewed_by).maybeSingle();
    reviewer = (profile as { full_name: string } | null)?.full_name ?? null;
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/applications" className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
        ← All applications
      </Link>

      <PageHeading
        title={application.full_name}
        description={`Applied on ${formatDate(application.created_at)}`}
        actions={<Badge tone={TONES[application.status] ?? "muted"}>{application.status}</Badge>}
      />

      {!application.user_id ? (
        <AuthAlert variant="warning" title="Not linked to an account">
          This application was submitted without a member account. You can approve it, but the applicant won&apos;t be able to sign in until they have an account.
        </AuthAlert>
      ) : null}

      <section aria-labelledby="applicant-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="applicant-heading" className="mb-4 text-lg sm:text-lg">Applicant details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="Email" value={application.email} />
          <Item label="Phone" value={application.phone} />
          <Item label="Date of birth" value={application.date_of_birth ? formatDate(application.date_of_birth) : null} />
          <Item label="Gender" value={application.gender} />
          <Item label="Sector / cell" value={application.sector_or_cell} />
          <Item label="School or occupation" value={application.school_or_occupation} />
        </dl>
      </section>

      <section aria-labelledby="motivation-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="motivation-heading" className="mb-4 text-lg sm:text-lg">In their words</h2>
        <dl className="space-y-4">
          <Item label="Motivation" value={application.motivation} />
          <Item label="Skills or interests" value={application.skills_or_interests} />
        </dl>
      </section>

      {application.reviewed_at ? (
        <p className="text-sm text-muted-foreground">
          Reviewed on {formatDate(application.reviewed_at)}
          {reviewer ? ` by ${reviewer}` : ""}.
        </p>
      ) : null}

      <section aria-labelledby="decision-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="decision-heading" className="mb-4 text-lg sm:text-lg">Decision</h2>
        <ApplicationReviewActions
          application={{ id: application.id, status: application.status, review_notes: application.review_notes }}
          notifyDefault={settings.auto_email_notifications}
        />
      </section>
    </div>
  );
}
