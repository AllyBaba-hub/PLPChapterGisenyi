"use server";

import { revalidatePath } from "next/cache";
import { adminAudit, clean, fail, getAdminContext, type ActionResult } from "@/lib/admin-actions";
import { getEmailUsage } from "@/lib/admin-data";
import { isUuid } from "@/lib/utils";

export interface ActivityAudience {
  recipients: string[];
  monthlyUsage: number;
  autoDefault: boolean;
}

/** Active members who have email alerts switched on, plus this month's recorded EmailJS usage. */
export async function getActivityAudience(): Promise<ActionResult<ActivityAudience>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  const [members, settings, monthlyUsage] = await Promise.all([
    ctx.supabase
      .from("profiles")
      .select("email")
      .eq("status", "active")
      .in("role", ["member", "admin", "super_admin"])
      .eq("email_notifications", true)
      .limit(2000),
    ctx.supabase.from("chapter_settings").select("auto_email_notifications").eq("id", 1).maybeSingle(),
    getEmailUsage(ctx.supabase),
  ]);

  if (members.error) {
    console.error("[admin/notifications] audience:", members.error.message);
    return fail("We couldn't load the recipient list. Please try again.");
  }

  const recipients = Array.from(
    new Set(((members.data ?? []) as Array<{ email: string }>).map((row) => row.email.trim().toLowerCase()).filter(Boolean))
  );

  return {
    ok: true,
    data: {
      recipients,
      monthlyUsage,
      autoDefault: (settings.data as { auto_email_notifications: boolean } | null)?.auto_email_notifications ?? true,
    },
  };
}

export interface EmailLogInput {
  template: "activity" | "account";
  kind: string;
  entityType: string;
  entityId: string;
  requests: number;
  recipients: number;
  failedRecipients?: number;
  error?: string;
}

/** Records an email send (done in the browser through EmailJS) so usage can be tracked. */
export async function logEmailNotification(input: EmailLogInput): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  const requests = Math.max(0, Math.min(500, Math.floor(Number(input.requests) || 0)));
  const recipients = Math.max(0, Math.min(5000, Math.floor(Number(input.recipients) || 0)));
  const failed = Math.max(0, Math.min(5000, Math.floor(Number(input.failedRecipients) || 0)));

  await adminAudit(
    ctx,
    requests > 0 ? "EMAIL_NOTIFICATION_SENT" : "EMAIL_NOTIFICATION_FAILED",
    clean(input.entityType, 40) || "notification",
    clean(input.entityId, 80) || null,
    {
      template: input.template === "account" ? "account" : "activity",
      kind: clean(input.kind, 40),
      requests,
      recipients,
      failed_recipients: failed,
      ...(input.error ? { error: clean(input.error, 80) } : {}),
    }
  );
  return { ok: true };
}

export async function markEventNotified(eventId: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(eventId)) return fail("Invalid request.");

  const { error } = await ctx.supabase.from("events").update({ notification_sent: true }).eq("id", eventId);
  if (error) {
    console.error("[admin/notifications] mark event:", error.message);
    return fail("The alert was sent, but we couldn't mark the event as notified.");
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}/edit`);
  return { ok: true };
}
