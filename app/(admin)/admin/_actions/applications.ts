"use server";

import { adminAudit, clean, dbMessage, fail, getAdminContext, revalidateAdmin, type ActionResult } from "@/lib/admin-actions";
import { isUuid } from "@/lib/utils";

export interface ApplicantNotice {
  email: string;
  name: string;
  memberCode: string | null;
  linkedAccount: boolean;
}

interface ApplicationRow {
  id: string;
  status: "pending" | "approved" | "rejected";
  user_id: string | null;
  email: string;
  full_name: string;
}

async function loadApplication(
  supabase: Parameters<typeof adminAudit>[0]["supabase"],
  id: string
): Promise<ApplicationRow | null> {
  const { data, error } = await supabase
    .from("membership_applications")
    .select("id, status, user_id, email, full_name")
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[admin/applications] load:", error.message);
  return (data as ApplicationRow | null) ?? null;
}

export async function approveApplication(id: string, notes: string): Promise<ActionResult<ApplicantNotice>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const application = await loadApplication(ctx.supabase, id);
  if (!application) return fail("We couldn't find that application.");
  if (application.status === "approved") return fail("This application is already approved.");

  const reviewNotes = clean(notes, 1000, true);
  // The database function checks admin rights, upgrades the profile, assigns the
  // member code and writes its own APPLICATION_APPROVED audit entry atomically.
  const { error } = await ctx.supabase.rpc("approve_membership_application", {
    p_application_id: id,
    p_review_notes: reviewNotes || null,
  });
  if (error) {
    console.error("[admin/applications] approve:", error.message);
    return fail(dbMessage(error, "We couldn't approve this application. Please try again."));
  }

  let memberCode: string | null = null;
  if (application.user_id) {
    const { data } = await ctx.supabase.from("profiles").select("member_code").eq("id", application.user_id).maybeSingle();
    memberCode = (data as { member_code: string | null } | null)?.member_code ?? null;
  }

  revalidateAdmin("/admin/applications", `/admin/applications/${id}`, "/admin/members");
  return {
    ok: true,
    message: application.user_id
      ? "Application approved. The applicant is now an active member."
      : "Application approved, but it isn't linked to an account, so the applicant can't sign in yet.",
    data: {
      email: application.email,
      name: application.full_name,
      memberCode,
      linkedAccount: Boolean(application.user_id),
    },
  };
}

export async function rejectApplication(id: string, notes: string): Promise<ActionResult<ApplicantNotice>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const application = await loadApplication(ctx.supabase, id);
  if (!application) return fail("We couldn't find that application.");
  if (application.status !== "pending") return fail("Only pending applications can be rejected.");

  const reviewNotes = clean(notes, 1000, true);
  const { error } = await ctx.supabase
    .from("membership_applications")
    .update({
      status: "rejected",
      review_notes: reviewNotes || null,
      reviewed_by: ctx.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    console.error("[admin/applications] reject:", error.message);
    return fail("We couldn't reject this application. Please try again.");
  }

  await adminAudit(ctx, "APPLICATION_REJECTED", "application", id, {
    applicant_email: application.email,
    applicant_name: application.full_name,
  });
  revalidateAdmin("/admin/applications", `/admin/applications/${id}`);

  return {
    ok: true,
    message: "Application rejected.",
    data: { email: application.email, name: application.full_name, memberCode: null, linkedAccount: Boolean(application.user_id) },
  };
}

export async function updateApplicationNotes(id: string, notes: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const { error } = await ctx.supabase
    .from("membership_applications")
    .update({ review_notes: clean(notes, 1000, true) || null })
    .eq("id", id);

  if (error) {
    console.error("[admin/applications] notes:", error.message);
    return fail("We couldn't save the notes. Please try again.");
  }

  await adminAudit(ctx, "APPLICATION_NOTES_UPDATED", "application", id);
  revalidateAdmin(`/admin/applications/${id}`);
  return { ok: true, message: "Notes saved." };
}
