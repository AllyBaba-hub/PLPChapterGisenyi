"use server";

import { revalidatePath } from "next/cache";
import { SOCIAL_KEYS } from "@/lib/admin-rules";
import { isValidEmail, normalizeEmail } from "@/lib/auth-validation";
import {
  adminAudit,
  clean,
  dbMessage,
  fail,
  getAdminContext,
  isHttpsUrl,
  revalidateAdmin,
  revalidatePublic,
  type ActionResult,
} from "@/lib/admin-actions";

export interface SettingsInput {
  chapter_name: string;
  parent_organization: string;
  district_location: string;
  contact_email: string;
  contact_phone: string;
  about_summary: string;
  applications_open: boolean;
  auto_email_notifications: boolean;
  social_links: Record<string, string>;
}

const PHONE_PATTERN = /^[+()\d][\d\s()+-]{6,19}$/;

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  const values = {
    chapter_name: clean(input.chapter_name, 100),
    parent_organization: clean(input.parent_organization, 120),
    district_location: clean(input.district_location, 160),
    contact_email: normalizeEmail(clean(input.contact_email, 254)),
    contact_phone: clean(input.contact_phone, 20),
    about_summary: clean(input.about_summary, 600, true),
  };

  const fieldErrors: Record<string, string> = {};
  if (values.chapter_name.length < 2) fieldErrors.chapter_name = "Enter the chapter name.";
  if (values.parent_organization.length < 2) fieldErrors.parent_organization = "Enter the parent organization.";
  if (values.district_location.length < 2) fieldErrors.district_location = "Enter the chapter location.";
  if (!isValidEmail(values.contact_email)) fieldErrors.contact_email = "Enter a valid contact email address.";
  if (values.contact_phone && !PHONE_PATTERN.test(values.contact_phone)) {
    fieldErrors.contact_phone = "Enter a valid phone number or leave this blank.";
  }
  if (values.about_summary.length < 20) fieldErrors.about_summary = "Write a summary of at least 20 characters.";

  const socials: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    const raw = clean(input.social_links?.[key], 300);
    if (!raw) continue;
    if (!isHttpsUrl(raw)) {
      fieldErrors[`social_${key}`] = "Use a full link starting with https://";
      continue;
    }
    socials[key] = new URL(raw).toString();
  }

  if (Object.keys(fieldErrors).length > 0) return fail("Please fix the highlighted fields.", fieldErrors);

  const { data: before } = await ctx.supabase
    .from("chapter_settings")
    .select("chapter_name, parent_organization, district_location, contact_email, contact_phone, about_summary, applications_open, auto_email_notifications, social_links")
    .eq("id", 1)
    .maybeSingle();

  const update = {
    ...values,
    contact_phone: values.contact_phone || null,
    applications_open: Boolean(input.applications_open),
    auto_email_notifications: Boolean(input.auto_email_notifications),
    social_links: socials,
    updated_by: ctx.user.id,
  };

  const { error } = await ctx.supabase.from("chapter_settings").update(update).eq("id", 1);
  if (error) {
    console.error("[admin/settings] save:", error.message);
    return fail(dbMessage(error, "We couldn't save the settings. Please try again."));
  }

  const previous = (before ?? {}) as Record<string, unknown>;
  const changed = (Object.keys(update) as Array<keyof typeof update>).filter(
    (key) => key !== "updated_by" && JSON.stringify(previous[key] ?? null) !== JSON.stringify(update[key] ?? null)
  );
  await adminAudit(ctx, "SETTINGS_UPDATED", "settings", "1", { fields: changed });

  revalidatePublic();
  revalidatePath("/member", "layout");
  revalidateAdmin("/admin/settings");
  return { ok: true, message: "Settings saved." };
}
