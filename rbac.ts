import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/* -------------------------------------------------------------------------- */
/* Types (mirror public.user_role and public.member_status enums)             */
/* -------------------------------------------------------------------------- */

export const USER_ROLES = [
  "visitor",
  "applicant",
  "member",
  "admin",
  "super_admin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MEMBER_STATUSES = ["pending", "active", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export interface Profile {
  id: string;
  member_code: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  sector_or_cell: string | null;
  school_or_occupation: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: MemberStatus;
  email_notifications: boolean;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionAndProfile {
  supabase: SupabaseClient;
  user: User | null;
  profile: Profile | null;
}

/* -------------------------------------------------------------------------- */
/* Role hierarchy & pure access checks (edge-safe, shared with middleware.ts) */
/* -------------------------------------------------------------------------- */

export const ROLE_RANK: Record<UserRole, number> = {
  visitor: 0,
  applicant: 1,
  member: 2,
  admin: 3,
  super_admin: 4,
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function isMemberStatus(value: unknown): value is MemberStatus {
  return (
    typeof value === "string" && (MEMBER_STATUSES as readonly string[]).includes(value)
  );
}

/** True when `role` is at least as privileged as `minimum`. */
export function hasRole(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Mirrors SQL public.is_active_member(): active status and role >= member. */
export function canAccessMember(role: UserRole, status: MemberStatus): boolean {
  return status === "active" && hasRole(role, "member");
}

/** Mirrors SQL public.is_admin(): active status and role >= admin. */
export function canAccessAdmin(role: UserRole, status: MemberStatus): boolean {
  return status === "active" && hasRole(role, "admin");
}

/** Mirrors SQL public.is_super_admin(). */
export function isSuperAdmin(role: UserRole, status: MemberStatus): boolean {
  return status === "active" && role === "super_admin";
}

/** Restricts redirect targets to same-site relative paths (prevents open redirects). */
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Server helpers                                                             */
/* -------------------------------------------------------------------------- */

const PROFILE_COLUMNS =
  "id, member_code, full_name, email, phone, sector_or_cell, school_or_occupation, bio, avatar_url, role, status, email_notifications, joined_at, created_at, updated_at";

/**
 * Resolves the current session (validated with Supabase Auth) and the matching
 * profiles row. Returns nulls for anonymous visitors or missing profiles.
 */
export async function getSessionAndProfile(): Promise<SessionAndProfile> {
  // Lazy import keeps next/headers out of the middleware bundle.
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, user: null, profile: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { supabase, user, profile: null };
  }

  return { supabase, user, profile: data as Profile };
}

function loginUrl(nextPath?: string, error?: string): string {
  const params = new URLSearchParams();
  const safeNext = sanitizeNextPath(nextPath);
  if (safeNext) params.set("next", safeNext);
  if (error) params.set("error", error);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

/**
 * Guards Server Components / layouts under /member.
 * Redirects when the visitor is anonymous, suspended, or not yet an active member.
 */
export async function requireMember(
  nextPath: string = "/member"
): Promise<SessionAndProfile & { user: User; profile: Profile }> {
  const session = await getSessionAndProfile();
  const { user, profile } = session;

  if (!user) redirect(loginUrl(nextPath));
  if (!profile) redirect(loginUrl(nextPath, "profile-missing"));
  if (profile.status === "suspended") redirect(loginUrl(undefined, "suspended"));
  if (!canAccessMember(profile.role, profile.status)) {
    redirect("/join?notice=pending-approval");
  }

  return { ...session, user, profile };
}

/**
 * Guards Server Components / layouts under /admin.
 * Active members without admin rights are sent back to the member portal.
 */
export async function requireAdmin(
  nextPath: string = "/admin"
): Promise<SessionAndProfile & { user: User; profile: Profile }> {
  const session = await getSessionAndProfile();
  const { user, profile } = session;

  if (!user) redirect(loginUrl(nextPath));
  if (!profile) redirect(loginUrl(nextPath, "profile-missing"));
  if (profile.status === "suspended") redirect(loginUrl(undefined, "suspended"));
  if (canAccessAdmin(profile.role, profile.status)) {
    return { ...session, user, profile };
  }
  if (canAccessMember(profile.role, profile.status)) {
    redirect("/member?error=forbidden");
  }
  redirect("/join?notice=pending-approval");
}

/**
 * Authorization for Route Handlers (/api/*), which must answer with JSON
 * status codes rather than redirects.
 */
export type ApiAuthorization =
  | { ok: true; supabase: SupabaseClient; user: User; profile: Profile }
  | { ok: false; status: 401 | 403; error: string };

export async function authorizeApi(
  minimum: "member" | "admin" | "super_admin"
): Promise<ApiAuthorization> {
  const { supabase, user, profile } = await getSessionAndProfile();

  if (!user || !profile) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const allowed =
    minimum === "member"
      ? canAccessMember(profile.role, profile.status)
      : minimum === "admin"
        ? canAccessAdmin(profile.role, profile.status)
        : isSuperAdmin(profile.role, profile.status);

  if (!allowed) {
    return { ok: false, status: 403, error: "You do not have permission to do this." };
  }

  return { ok: true, supabase, user, profile };
}
