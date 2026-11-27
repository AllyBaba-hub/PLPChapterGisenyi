"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/api-security";
import { validatePassword } from "@/lib/auth-validation";
import { authorizeApi, type Profile } from "@/lib/rbac";
import { avatarFolder, isOwnAvatarPath, MEDIA_BUCKET } from "@/lib/storage";
import { isUuid } from "@/lib/utils";
import { extractClientIp, recordAuditLog, type AuditAction } from "@/services/audit";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const PHONE_PATTERN = /^[+()\d][\d\s()+-]{6,19}$/;

function clean(value: unknown, max: number, multiline = false): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\r\n/g, "\n");
  return (multiline ? normalized : normalized.replace(/\s+/g, " ")).trim().slice(0, max);
}

async function getContext() {
  const auth = await authorizeApi("member");
  if (!auth.ok) {
    return {
      ok: false as const,
      error:
        auth.status === 401
          ? "Your session has expired. Please sign in again."
          : "You don't have permission to do this.",
    };
  }
  return auth;
}

async function audit(
  profile: Profile,
  action: AuditAction,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const requestHeaders = await headers();
  await recordAuditLog({
    action,
    entityType,
    entityId,
    actorId: profile.id,
    actorEmail: profile.email,
    metadata,
    ip: extractClientIp(requestHeaders as unknown as Headers),
  });
}

const tooMany: ActionResult = { ok: false, error: "Too many requests. Please wait a moment and try again." };
const failed = (what: string): ActionResult => ({
  ok: false,
  error: `We couldn't ${what} right now. Please try again.`,
});

/* ----------------------------------------------------------------- profile */

export interface ProfileInput {
  full_name: string;
  phone: string;
  sector_or_cell: string;
  school_or_occupation: string;
  bio: string;
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!checkRateLimit(`member:profile:${ctx.user.id}`, 20, 60_000)) return tooMany;

  const values = {
    full_name: clean(input?.full_name, 120),
    phone: clean(input?.phone, 20),
    sector_or_cell: clean(input?.sector_or_cell, 120),
    school_or_occupation: clean(input?.school_or_occupation, 160),
    bio: clean(input?.bio, 500, true),
  };

  const fieldErrors: Record<string, string> = {};
  if (values.full_name.length < 2) fieldErrors.full_name = "Enter your full name.";
  if (values.phone && !PHONE_PATTERN.test(values.phone)) {
    fieldErrors.phone = "Enter a valid phone number, for example +250 788 000 000.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const update = {
    full_name: values.full_name,
    phone: values.phone || null,
    sector_or_cell: values.sector_or_cell || null,
    school_or_occupation: values.school_or_occupation || null,
    bio: values.bio || null,
  };

  const { error } = await ctx.supabase.from("profiles").update(update).eq("id", ctx.user.id);
  if (error) {
    console.error("[member/actions] updateProfile:", error.message);
    return failed("save your profile");
  }

  const changed = (Object.keys(update) as Array<keyof typeof update>).filter(
    (key) => (ctx.profile[key] ?? null) !== update[key]
  );
  if (changed.length > 0) {
    await audit(ctx.profile, "PROFILE_UPDATED", "member", ctx.profile.id, { fields: changed });
  }

  revalidatePath("/member", "layout");
  return { ok: true, message: "Your profile was saved." };
}

/* ------------------------------------------------------------------ avatar */

async function removeAvatarFiles(
  supabase: Awaited<ReturnType<typeof getContext>> extends infer C ? (C extends { supabase: infer S } ? S : never) : never,
  userId: string,
  keepFileName?: string
): Promise<void> {
  try {
    const folder = avatarFolder(userId);
    const { data } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 100 });
    const stale = (data ?? [])
      .map((file) => file.name)
      .filter((name) => name && name !== keepFileName)
      .map((name) => `${folder}/${name}`);
    if (stale.length > 0) await supabase.storage.from(MEDIA_BUCKET).remove(stale);
  } catch (error) {
    console.error("[member/actions] avatar cleanup:", error instanceof Error ? error.message : error);
  }
}

/** Called after the browser uploaded a compressed photo to avatars/{user_id}/. */
export async function setAvatar(path: string): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!checkRateLimit(`member:avatar:${ctx.user.id}`, 10, 60_000)) return tooMany;

  if (!isOwnAvatarPath(path, ctx.user.id)) {
    return { ok: false, error: "That upload location isn't valid." };
  }

  const { data } = ctx.supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ avatar_url: data.publicUrl })
    .eq("id", ctx.user.id);

  if (error) {
    console.error("[member/actions] setAvatar:", error.message);
    await ctx.supabase.storage.from(MEDIA_BUCKET).remove([path]);
    return failed("update your photo");
  }

  await removeAvatarFiles(ctx.supabase, ctx.user.id, path.split("/").pop());
  await audit(ctx.profile, "AVATAR_UPDATED", "member", ctx.profile.id);
  revalidatePath("/member", "layout");
  return { ok: true, message: "Your profile photo was updated." };
}

export async function removeAvatar(): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!checkRateLimit(`member:avatar:${ctx.user.id}`, 10, 60_000)) return tooMany;

  const { error } = await ctx.supabase.from("profiles").update({ avatar_url: null }).eq("id", ctx.user.id);
  if (error) {
    console.error("[member/actions] removeAvatar:", error.message);
    return failed("remove your photo");
  }

  await removeAvatarFiles(ctx.supabase, ctx.user.id);
  await audit(ctx.profile, "AVATAR_REMOVED", "member", ctx.profile.id);
  revalidatePath("/member", "layout");
  return { ok: true, message: "Your profile photo was removed." };
}

/* ---------------------------------------------------------------- settings */

export async function setEmailNotifications(enabled: boolean): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!checkRateLimit(`member:prefs:${ctx.user.id}`, 20, 60_000)) return tooMany;
  if (typeof enabled !== "boolean") return { ok: false, error: "Invalid request." };

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ email_notifications: enabled })
    .eq("id", ctx.user.id);

  if (error) {
    console.error("[member/actions] setEmailNotifications:", error.message);
    return failed("save your preference");
  }

  await audit(ctx.profile, "PREFERENCES_UPDATED", "member", ctx.profile.id, { email_notifications: enabled });
  revalidatePath("/member/settings");
  return {
    ok: true,
    message: enabled ? "Email notifications are on." : "Email notifications are off.",
  };
}

export async function changePassword(input: { current: string; next: string }): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!checkRateLimit(`member:password:${ctx.user.id}`, 5, 10 * 60_000)) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const current = typeof input?.current === "string" ? input.current : "";
  const next = typeof input?.next === "string" ? input.next : "";
  const email = ctx.user.email;

  if (!email) return { ok: false, error: "Your account has no email address, so the password can't be changed here." };
  if (!current) return { ok: false, error: "Enter your current password.", fieldErrors: { current: "Enter your current password." } };

  const passwordError = validatePassword(next);
  if (passwordError) return { ok: false, error: passwordError, fieldErrors: { next: passwordError } };
  if (next === current) {
    const message = "Choose a password that is different from your current one.";
    return { ok: false, error: message, fieldErrors: { next: message } };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return failed("change your password");

  // Verify the current password with a throwaway client so the member's own session is untouched.
  const verifier = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email, password: current });
  if (verifyError) {
    if (verifyError.status === 429) {
      return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
    }
    await audit(ctx.profile, "AUTH_PASSWORD_CHANGE_FAILED", "auth", ctx.profile.id, { reason: "wrong_current_password" });
    const message = "Your current password is incorrect.";
    return { ok: false, error: message, fieldErrors: { current: message } };
  }
  await verifier.auth.signOut({ scope: "local" });

  const { error } = await ctx.supabase.auth.updateUser({ password: next });
  if (error) {
    if (error.code === "same_password") {
      const message = "Choose a password that is different from your current one.";
      return { ok: false, error: message, fieldErrors: { next: message } };
    }
    if (error.code === "weak_password") {
      const message = "That password is too easy to guess. Try a longer or less common one.";
      return { ok: false, error: message, fieldErrors: { next: message } };
    }
    console.error("[member/actions] changePassword:", error.message);
    return failed("change your password");
  }

  await ctx.supabase.auth.signOut({ scope: "others" });
  await audit(ctx.profile, "AUTH_PASSWORD_CHANGED", "auth", ctx.profile.id, { method: "settings" });
  revalidatePath("/member/settings");
  return { ok: true, message: "Your password was changed. Other devices were signed out." };
}

/* ----------------------------------------------------------- announcements */

export async function markAnnouncementRead(announcementId: string, read: boolean): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!checkRateLimit(`member:announcements:${ctx.user.id}`, 60, 60_000)) return tooMany;
  if (!isUuid(announcementId) || typeof read !== "boolean") return { ok: false, error: "Invalid request." };

  const { error } = read
    ? await ctx.supabase
        .from("announcement_reads")
        .upsert(
          { announcement_id: announcementId, user_id: ctx.user.id },
          { onConflict: "announcement_id,user_id", ignoreDuplicates: true }
        )
    : await ctx.supabase
        .from("announcement_reads")
        .delete()
        .eq("announcement_id", announcementId)
        .eq("user_id", ctx.user.id);

  if (error) {
    console.error("[member/actions] markAnnouncementRead:", error.message);
    return failed("update that announcement");
  }

  revalidatePath("/member", "layout");
  return { ok: true };
}

export async function markAllAnnouncementsRead(): Promise<ActionResult> {
  const ctx = await getContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!checkRateLimit(`member:announcements:${ctx.user.id}`, 60, 60_000)) return tooMany;

  const [announcements, reads] = await Promise.all([
    ctx.supabase.from("announcements").select("id").eq("is_published", true).limit(200),
    ctx.supabase.from("announcement_reads").select("announcement_id").eq("user_id", ctx.user.id),
  ]);

  if (announcements.error || reads.error) {
    console.error("[member/actions] markAll:", announcements.error?.message ?? reads.error?.message);
    return failed("update your announcements");
  }

  const alreadyRead = new Set(
    ((reads.data ?? []) as Array<{ announcement_id: string }>).map((row) => row.announcement_id)
  );
  const rows = ((announcements.data ?? []) as Array<{ id: string }>)
    .filter((item) => !alreadyRead.has(item.id))
    .map((item) => ({ announcement_id: item.id, user_id: ctx.user.id }));

  if (rows.length > 0) {
    const { error } = await ctx.supabase
      .from("announcement_reads")
      .upsert(rows, { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
    if (error) {
      console.error("[member/actions] markAll upsert:", error.message);
      return failed("update your announcements");
    }
  }

  revalidatePath("/member", "layout");
  return { ok: true, message: "All announcements are marked as read." };
}
