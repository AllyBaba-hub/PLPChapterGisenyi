"use server";

import { revalidatePath } from "next/cache";
import { kigaliLocalToIso } from "@/lib/kigali-time";
import {
  adminAudit,
  clean,
  dbMessage,
  fail,
  getAdminContext,
  revalidateAdmin,
  revalidatePublic,
  uniqueSlug,
  type ActionResult,
} from "@/lib/admin-actions";
import { isAdminImagePath, MEDIA_BUCKET, storagePathFromPublicUrl } from "@/lib/storage";
import { isUuid } from "@/lib/utils";

export interface EventInput {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  location: string;
  start_local: string;
  end_local: string;
  max_capacity: string;
  is_published: boolean;
  cover: { action: "keep" | "remove" | "set"; path?: string };
}

type Supabase = Parameters<typeof adminAudit>[0]["supabase"];

interface ExistingEvent {
  slug: string;
  cover_image_url: string | null;
  is_published: boolean;
}

async function removeStoredImage(supabase: Supabase, url: string | null | undefined, folder: string): Promise<void> {
  const path = storagePathFromPublicUrl(url);
  if (!path || !path.startsWith(`${folder}/`)) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) console.error("[admin/events] storage cleanup:", error.message);
}

function revalidateEventPages(...slugs: Array<string | undefined>): void {
  revalidatePublic(slugs.filter((slug): slug is string => Boolean(slug)).map((slug) => `/events/${slug}`));
  revalidatePath("/member", "layout");
  revalidateAdmin("/admin/events");
}

export async function saveEvent(input: EventInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  const id = input.id && isUuid(input.id) ? input.id : undefined;
  if (input.id && !id) return fail("Invalid request.");

  const values = {
    title: clean(input.title, 150),
    summary: clean(input.summary, 300),
    description: clean(input.description, 10000, true),
    location: clean(input.location, 200),
  };
  const fieldErrors: Record<string, string> = {};
  if (values.title.length < 3) fieldErrors.title = "Enter an event title (at least 3 characters).";
  if (values.summary.length < 10) fieldErrors.summary = "Write a short summary (at least 10 characters).";
  if (values.description.length < 20) fieldErrors.description = "Describe the event (at least 20 characters).";
  if (values.location.length < 2) fieldErrors.location = "Enter where the event takes place.";

  const start = kigaliLocalToIso(input.start_local);
  const end = input.end_local ? kigaliLocalToIso(input.end_local) : null;
  if (!start) fieldErrors.start_local = "Choose a valid start date and time.";
  if (input.end_local && !end) fieldErrors.end_local = "Choose a valid end date and time.";
  if (start && end && end < start) fieldErrors.end_local = "The end must be after the start.";

  let capacity: number | null = null;
  const capacityText = clean(input.max_capacity, 6);
  if (capacityText) {
    capacity = Number.parseInt(capacityText, 10);
    if (!/^\d+$/.test(capacityText) || capacity < 1 || capacity > 100000) {
      fieldErrors.max_capacity = "Enter a whole number of places, or leave blank for no limit.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) return fail("Please fix the highlighted fields.", fieldErrors);

  let existing: ExistingEvent | null = null;
  if (id) {
    const { data } = await ctx.supabase.from("events").select("slug, cover_image_url, is_published").eq("id", id).maybeSingle();
    existing = data as ExistingEvent | null;
    if (!existing) return fail("We couldn't find that event.");
  }

  if (input.cover.action === "set" && !isAdminImagePath(input.cover.path, "events")) {
    return fail("That cover image upload isn't valid. Please choose the image again.");
  }

  const slug = await uniqueSlug(ctx.supabase, "events", clean(input.slug, 80) || values.title, id);

  let coverUrl: string | null | undefined;
  if (input.cover.action === "set" && input.cover.path) {
    coverUrl = ctx.supabase.storage.from(MEDIA_BUCKET).getPublicUrl(input.cover.path).data.publicUrl;
  } else if (input.cover.action === "remove") {
    coverUrl = null;
  }

  const record = {
    ...values,
    slug,
    start_time: start,
    end_time: end,
    max_capacity: capacity,
    is_published: Boolean(input.is_published),
    ...(coverUrl !== undefined ? { cover_image_url: coverUrl } : {}),
  };

  const query = id
    ? ctx.supabase.from("events").update(record).eq("id", id)
    : ctx.supabase.from("events").insert({ ...record, created_by: ctx.user.id });
  const { data, error } = await query.select("id, slug").single();

  if (error || !data) {
    console.error("[admin/events] save:", error?.message);
    if (input.cover.action === "set" && input.cover.path) {
      await ctx.supabase.storage.from(MEDIA_BUCKET).remove([input.cover.path]);
    }
    return fail(error ? dbMessage(error, "We couldn't save this event. Please try again.") : "We couldn't save this event.");
  }

  if (existing && coverUrl !== undefined && existing.cover_image_url && existing.cover_image_url !== coverUrl) {
    await removeStoredImage(ctx.supabase, existing.cover_image_url, "events");
  }

  const saved = data as { id: string; slug: string };
  await adminAudit(ctx, id ? "EVENT_UPDATED" : "EVENT_CREATED", "event", saved.id, {
    title: values.title,
    published: record.is_published,
  });
  revalidateEventPages(saved.slug, existing?.slug);

  return { ok: true, message: id ? "Event saved." : "Event created.", data: saved };
}

export async function setEventPublished(id: string, published: boolean): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id) || typeof published !== "boolean") return fail("Invalid request.");

  const { data, error } = await ctx.supabase
    .from("events")
    .update({ is_published: published })
    .eq("id", id)
    .select("slug, title")
    .maybeSingle();

  if (error || !data) {
    console.error("[admin/events] publish:", error?.message);
    return fail("We couldn't update that event. Please try again.");
  }

  const row = data as { slug: string; title: string };
  await adminAudit(ctx, published ? "EVENT_PUBLISHED" : "EVENT_UNPUBLISHED", "event", id, { title: row.title });
  revalidateEventPages(row.slug);
  return { ok: true, message: published ? "Event published." : "Event unpublished." };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const { data: event } = await ctx.supabase
    .from("events")
    .select("slug, title, cover_image_url")
    .eq("id", id)
    .maybeSingle();
  if (!event) return fail("We couldn't find that event.");
  const row = event as { slug: string; title: string; cover_image_url: string | null };

  const { error } = await ctx.supabase.from("events").delete().eq("id", id);
  if (error) {
    console.error("[admin/events] delete:", error.message);
    return fail("We couldn't delete that event. Please try again.");
  }

  await removeStoredImage(ctx.supabase, row.cover_image_url, "events");
  await adminAudit(ctx, "EVENT_DELETED", "event", id, { title: row.title });
  revalidateEventPages(row.slug);
  return { ok: true, message: "Event deleted." };
}

/* ------------------------------------------------------------ registrations */

function revalidateRegistrations(eventId?: string): void {
  revalidatePath("/member/history");
  revalidatePath("/member/events");
  revalidatePath("/member");
  revalidatePath("/admin/events/[id]/registrations", "page");
  if (eventId) revalidatePath(`/admin/events/${eventId}/registrations`);
}

export async function setAttendance(registrationId: string, attended: boolean): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(registrationId) || typeof attended !== "boolean") return fail("Invalid request.");

  const { data, error } = await ctx.supabase
    .from("event_registrations")
    .update({ attended })
    .eq("id", registrationId)
    .select("event_id")
    .maybeSingle();

  if (error || !data) {
    console.error("[admin/events] attendance:", error?.message);
    return fail("We couldn't update attendance. Please try again.");
  }

  const eventId = (data as { event_id: string }).event_id;
  await adminAudit(ctx, "ATTENDANCE_UPDATED", "event", eventId, { registration_id: registrationId, attended });
  revalidateRegistrations(eventId);
  return { ok: true };
}

export async function markAllAttended(eventId: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(eventId)) return fail("Invalid request.");

  const { data, error } = await ctx.supabase
    .from("event_registrations")
    .update({ attended: true })
    .eq("event_id", eventId)
    .eq("attended", false)
    .select("id");

  if (error) {
    console.error("[admin/events] attendance bulk:", error.message);
    return fail("We couldn't update attendance. Please try again.");
  }

  const count = data?.length ?? 0;
  await adminAudit(ctx, "ATTENDANCE_UPDATED", "event", eventId, { bulk: true, marked: count });
  revalidateRegistrations(eventId);
  return { ok: true, message: count > 0 ? `Marked ${count} registrant${count === 1 ? "" : "s"} as attended.` : "Everyone is already marked as attended." };
}

export async function removeRegistration(registrationId: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(registrationId)) return fail("Invalid request.");

  const { data, error } = await ctx.supabase
    .from("event_registrations")
    .delete()
    .eq("id", registrationId)
    .select("event_id, user_id")
    .maybeSingle();

  if (error || !data) {
    console.error("[admin/events] remove registration:", error?.message);
    return fail("We couldn't remove that registration. Please try again.");
  }

  const row = data as { event_id: string; user_id: string };
  await adminAudit(ctx, "REGISTRATION_REMOVED", "event", row.event_id, { member_id: row.user_id });
  revalidateRegistrations(row.event_id);
  return { ok: true, message: "Registration removed." };
}
