"use server";

import { revalidatePath } from "next/cache";
import { adminAudit, clean, dbMessage, fail, getAdminContext, revalidateAdmin, type ActionResult } from "@/lib/admin-actions";
import { isUuid } from "@/lib/utils";

export interface AnnouncementInput {
  id?: string;
  title: string;
  body: string;
  priority: string;
  is_published: boolean;
}

const PRIORITIES = ["normal", "important", "urgent"] as const;

function refreshMemberViews(): void {
  revalidatePath("/member", "layout");
  revalidateAdmin("/admin/announcements");
}

export async function saveAnnouncement(input: AnnouncementInput): Promise<ActionResult<{ id: string }>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  const id = input.id && isUuid(input.id) ? input.id : undefined;
  if (input.id && !id) return fail("Invalid request.");

  const title = clean(input.title, 150);
  const body = clean(input.body, 5000, true);
  const priority = (PRIORITIES as readonly string[]).includes(input.priority) ? input.priority : "normal";

  const fieldErrors: Record<string, string> = {};
  if (title.length < 3) fieldErrors.title = "Enter a title (at least 3 characters).";
  if (body.length < 5) fieldErrors.body = "Write the announcement (at least 5 characters).";
  if (Object.keys(fieldErrors).length > 0) return fail("Please fix the highlighted fields.", fieldErrors);

  const record = { title, body, priority, is_published: Boolean(input.is_published) };
  const query = id
    ? ctx.supabase.from("announcements").update(record).eq("id", id)
    : ctx.supabase.from("announcements").insert({ ...record, created_by: ctx.user.id });
  const { data, error } = await query.select("id").single();

  if (error || !data) {
    console.error("[admin/announcements] save:", error?.message);
    return fail(error ? dbMessage(error, "We couldn't save this announcement. Please try again.") : "We couldn't save this announcement.");
  }

  const saved = data as { id: string };
  await adminAudit(ctx, id ? "ANNOUNCEMENT_UPDATED" : "ANNOUNCEMENT_CREATED", "announcement", saved.id, {
    title,
    priority,
    published: record.is_published,
  });
  refreshMemberViews();
  return { ok: true, message: id ? "Announcement saved." : "Announcement created.", data: saved };
}

export async function setAnnouncementPublished(id: string, published: boolean): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id) || typeof published !== "boolean") return fail("Invalid request.");

  const { data, error } = await ctx.supabase
    .from("announcements")
    .update({ is_published: published })
    .eq("id", id)
    .select("title")
    .maybeSingle();

  if (error || !data) {
    console.error("[admin/announcements] publish:", error?.message);
    return fail("We couldn't update that announcement. Please try again.");
  }

  await adminAudit(ctx, published ? "ANNOUNCEMENT_PUBLISHED" : "ANNOUNCEMENT_UNPUBLISHED", "announcement", id, {
    title: (data as { title: string }).title,
  });
  refreshMemberViews();
  return { ok: true, message: published ? "Announcement published." : "Announcement hidden from members." };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const { data, error } = await ctx.supabase.from("announcements").delete().eq("id", id).select("title").maybeSingle();
  if (error || !data) {
    console.error("[admin/announcements] delete:", error?.message);
    return fail("We couldn't delete that announcement. Please try again.");
  }

  await adminAudit(ctx, "ANNOUNCEMENT_DELETED", "announcement", id, { title: (data as { title: string }).title });
  refreshMemberViews();
  return { ok: true, message: "Announcement deleted." };
}
