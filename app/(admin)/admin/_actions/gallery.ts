"use server";

import {
  adminAudit,
  clean,
  dbMessage,
  fail,
  getAdminContext,
  revalidateAdmin,
  revalidatePublic,
  type ActionResult,
} from "@/lib/admin-actions";
import { isAdminImagePath, MEDIA_BUCKET } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { parseYouTubeId } from "@/lib/youtube";

export interface GalleryMeta {
  title: string;
  caption: string;
  alt_text: string;
  event_id: string;
}

function validateMeta(meta: GalleryMeta, requireAlt: boolean) {
  const values = {
    title: clean(meta.title, 120),
    caption: clean(meta.caption, 300),
    alt_text: clean(meta.alt_text, 200),
    event_id: meta.event_id && isUuid(meta.event_id) ? meta.event_id : null,
  };
  const fieldErrors: Record<string, string> = {};
  if (values.title.length < 2) fieldErrors.title = "Enter a title.";
  if (requireAlt && values.alt_text.length < 5) {
    fieldErrors.alt_text = "Describe the photo for people using screen readers (at least 5 characters).";
  }
  if (meta.event_id && !values.event_id) fieldErrors.event_id = "Choose a valid event.";
  return { values, fieldErrors };
}

export async function createGalleryPhoto(
  meta: GalleryMeta,
  path: string
): Promise<ActionResult<{ id: string }>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  const { values, fieldErrors } = validateMeta(meta, true);
  if (Object.keys(fieldErrors).length > 0) return fail("Please fix the highlighted fields.", fieldErrors);
  if (!isAdminImagePath(path, "gallery")) return fail("That photo upload isn't valid. Please choose the photo again.");

  const { data: publicUrl } = ctx.supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const { data, error } = await ctx.supabase
    .from("gallery_items")
    .insert({
      ...values,
      media_type: "photo",
      media_url: publicUrl.publicUrl,
      storage_path: path,
      uploaded_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[admin/gallery] create photo:", error?.message);
    await ctx.supabase.storage.from(MEDIA_BUCKET).remove([path]);
    return fail(error ? dbMessage(error, "We couldn't save that photo. Please try again.") : "We couldn't save that photo.");
  }

  const id = (data as { id: string }).id;
  await adminAudit(ctx, "GALLERY_CREATED", "gallery", id, { title: values.title, media_type: "photo" });
  revalidatePublic();
  revalidateAdmin("/admin/gallery");
  return { ok: true, message: "Photo added to the gallery.", data: { id } };
}

export async function createGalleryVideo(
  meta: GalleryMeta,
  url: string
): Promise<ActionResult<{ id: string }>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  const { values, fieldErrors } = validateMeta(meta, false);
  const videoId = parseYouTubeId(clean(url, 300));
  if (!videoId) fieldErrors.url = "Paste a YouTube link, for example https://www.youtube.com/watch?v=…";
  if (Object.keys(fieldErrors).length > 0 || !videoId) {
    return fail("Please fix the highlighted fields.", fieldErrors);
  }

  const { data, error } = await ctx.supabase
    .from("gallery_items")
    .insert({
      ...values,
      alt_text: values.alt_text || `Video: ${values.title}`,
      media_type: "video",
      media_url: `https://www.youtube.com/watch?v=${videoId}`,
      storage_path: null,
      uploaded_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[admin/gallery] create video:", error?.message);
    return fail(error ? dbMessage(error, "We couldn't save that video. Please try again.") : "We couldn't save that video.");
  }

  const id = (data as { id: string }).id;
  await adminAudit(ctx, "GALLERY_CREATED", "gallery", id, { title: values.title, media_type: "video" });
  revalidatePublic();
  revalidateAdmin("/admin/gallery");
  return { ok: true, message: "Video added to the gallery.", data: { id } };
}

export async function updateGalleryItem(id: string, meta: GalleryMeta): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const { values, fieldErrors } = validateMeta(meta, true);
  if (Object.keys(fieldErrors).length > 0) return fail("Please fix the highlighted fields.", fieldErrors);

  const { error } = await ctx.supabase.from("gallery_items").update(values).eq("id", id);
  if (error) {
    console.error("[admin/gallery] update:", error.message);
    return fail(dbMessage(error, "We couldn't save those changes. Please try again."));
  }

  await adminAudit(ctx, "GALLERY_UPDATED", "gallery", id, { title: values.title });
  revalidatePublic();
  revalidateAdmin("/admin/gallery");
  return { ok: true, message: "Gallery item updated." };
}

export async function deleteGalleryItem(id: string): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!isUuid(id)) return fail("Invalid request.");

  const { data: item } = await ctx.supabase
    .from("gallery_items")
    .select("title, media_type, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!item) return fail("We couldn't find that gallery item.");
  const row = item as { title: string; media_type: string; storage_path: string | null };

  const { error } = await ctx.supabase.from("gallery_items").delete().eq("id", id);
  if (error) {
    console.error("[admin/gallery] delete:", error.message);
    return fail("We couldn't delete that item. Please try again.");
  }

  if (row.storage_path) {
    const { error: storageError } = await ctx.supabase.storage.from(MEDIA_BUCKET).remove([row.storage_path]);
    if (storageError) console.error("[admin/gallery] storage cleanup:", storageError.message);
  }

  await adminAudit(ctx, "GALLERY_DELETED", "gallery", id, { title: row.title, media_type: row.media_type });
  revalidatePublic();
  revalidateAdmin("/admin/gallery");
  return { ok: true, message: "Gallery item deleted." };
}
