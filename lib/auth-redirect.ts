import {
  canAccessAdmin,
  canAccessMember,
  sanitizeNextPath,
  type MemberStatus,
  type UserRole,
} from "@/lib/rbac";

const AUTH_AND_API_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/api"];

/** True only for same-site relative paths with no control characters or scheme tricks. */
export function isSafeInternalPath(value: string | null | undefined): value is string {
  const safe = sanitizeNextPath(value);
  if (!safe) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(safe)) return false;
  try {
    const base = "http://plp.invalid";
    return new URL(safe, base).origin === base;
  } catch {
    return false;
  }
}

export interface RedirectProfile {
  role: UserRole;
  status: MemberStatus;
}

/** Default landing page for a signed-in profile. */
export function defaultPathFor(profile: RedirectProfile): string {
  if (profile.status === "suspended") return "/login?error=suspended";
  if (canAccessAdmin(profile.role, profile.status)) return "/admin";
  if (canAccessMember(profile.role, profile.status)) return "/member";
  return "/join?notice=pending-approval";
}

/**
 * Decides where to send a user after sign-in. Honors a safe `next` path only
 * when the profile is actually allowed to open it.
 */
export function resolvePostLoginPath(
  profile: RedirectProfile | null,
  next?: string | null
): string {
  if (!profile) return "/login?error=profile-missing";
  const fallback = defaultPathFor(profile);
  if (profile.status === "suspended") return fallback;
  if (!isSafeInternalPath(next)) return fallback;

  const pathOnly = next.split(/[?#]/)[0];
  if (AUTH_AND_API_PREFIXES.some((p) => pathOnly === p || pathOnly.startsWith(`${p}/`))) {
    return fallback;
  }
  if (pathOnly === "/admin" || pathOnly.startsWith("/admin/")) {
    return canAccessAdmin(profile.role, profile.status) ? next : fallback;
  }
  if (pathOnly === "/member" || pathOnly.startsWith("/member/")) {
    return canAccessMember(profile.role, profile.status) ? next : fallback;
  }
  return next;
}
