import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Known audit actions. Any string is accepted so new modules can add their own. */
export type KnownAuditAction =
  | "AUTH_FAILED_LOGIN"
  | "AUTH_PASSWORD_RESET"
  | "AUTH_PASSWORD_CHANGED"
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "ROLE_CHANGED"
  | "MEMBER_STATUS_CHANGED"
  | "MEMBERS_EXPORTED"
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "NEWS_CREATED"
  | "NEWS_UPDATED"
  | "NEWS_DELETED"
  | "GALLERY_CREATED"
  | "GALLERY_DELETED"
  | "SETTINGS_UPDATED"
  | "ANNOUNCEMENT_CREATED"
  | "ANNOUNCEMENT_UPDATED"
  | "EMAIL_NOTIFICATION_SENT";

export type AuditAction = KnownAuditAction | (string & {});

export type AuditEntityType =
  | "auth"
  | "application"
  | "member"
  | "event"
  | "news"
  | "gallery"
  | "announcement"
  | "message"
  | "settings"
  | (string & {});

export interface AuditLogInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
  /** Pass a Request/Headers to derive the IP, or an explicit IP string. */
  ip?: string | Request | Headers | null;
}

type HeaderSource = Request | Headers | { headers: Headers };

const IP_PATTERN = /^[0-9a-fA-F:.]{3,45}$/;

function cleanIp(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  let value = candidate.trim();
  // Strip IPv4 port (1.2.3.4:5678) and bracketed IPv6 ([::1]:5678).
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end > 0) value = value.slice(1, end);
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }
  return IP_PATTERN.test(value) ? value : null;
}

/**
 * Best-effort client IP from proxy headers (Vercel sets x-forwarded-for and
 * x-real-ip). Returns null when nothing valid is present.
 */
export function extractClientIp(source: HeaderSource): string | null {
  const headers =
    source instanceof Headers ? source : (source as { headers: Headers }).headers;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = cleanIp(forwarded.split(",")[0]);
    if (first) return first;
  }

  return (
    cleanIp(headers.get("x-real-ip")) ??
    cleanIp(headers.get("cf-connecting-ip")) ??
    null
  );
}

function resolveIp(ip: AuditLogInput["ip"]): string | null {
  if (!ip) return null;
  if (typeof ip === "string") return cleanIp(ip);
  return extractClientIp(ip);
}

/**
 * Writes a row to public.audit_logs with the service-role client (bypasses RLS).
 * Never throws: audit failures must not break the user-facing action.
 * Returns true when the row was stored.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<boolean> {
  try {
    const admin = createAdminClient();

    const { error } = await admin.from("audit_logs").insert({
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
      ip_address: resolveIp(input.ip),
    });

    if (error) {
      console.error("[audit] Failed to record audit log:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "[audit] Unexpected error while recording audit log:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}
