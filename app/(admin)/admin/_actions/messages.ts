"use server";

import { adminAudit, clean, fail, getAdminContext, revalidateAdmin, type ActionResult } from "@/lib/admin-actions";
import { isUuid } from "@/lib/utils";

const STATUSES = ["unread", "read", "replied", "archived"] as const;
export type MessageStatus = (typeof STATUSES)[number];

export async function setMessageStatus(id: string, status: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id) || !(STATUSES as readonly string[]).includes(status)) return fail("Invalid request.");

  const { error } = await ctx.supabase
    .from("contact_messages")
    .update({ status, handled_by: status === "unread" ? null : ctx.user.id })
    .eq("id", id);

  if (error) {
    console.error("[admin/messages] status:", error.message);
    return fail("We couldn't update that message. Please try again.");
  }

  // Opening a message marks it read; that is routine and not worth an audit row.
  if (status !== "read") await adminAudit(ctx, "MESSAGE_STATUS_CHANGED", "message", id, { status });
  revalidateAdmin("/admin/messages");
  return { ok: true };
}

export async function saveMessageNotes(id: string, notes: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const { error } = await ctx.supabase
    .from("contact_messages")
    .update({ admin_notes: clean(notes, 2000, true) || null })
    .eq("id", id);

  if (error) {
    console.error("[admin/messages] notes:", error.message);
    return fail("We couldn't save the notes. Please try again.");
  }

  await adminAudit(ctx, "MESSAGE_NOTES_UPDATED", "message", id);
  revalidateAdmin("/admin/messages");
  return { ok: true, message: "Notes saved." };
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const { data, error } = await ctx.supabase.from("contact_messages").delete().eq("id", id).select("subject").maybeSingle();
  if (error || !data) {
    console.error("[admin/messages] delete:", error?.message);
    return fail("We couldn't delete that message. Please try again.");
  }

  await adminAudit(ctx, "MESSAGE_DELETED", "message", id, { subject: (data as { subject: string }).subject });
  revalidateAdmin("/admin/messages");
  return { ok: true, message: "Message deleted." };
}
