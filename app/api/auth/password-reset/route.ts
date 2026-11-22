import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  isRecord,
  isSameOrigin,
  jsonNoStore,
  readJsonBody,
} from "@/lib/api-security";
import { isValidEmail, normalizeEmail } from "@/lib/auth-validation";
import { getSessionAndProfile } from "@/lib/rbac";
import { extractClientIp, recordAuditLog } from "@/services/audit";

export const dynamic = "force-dynamic";

/**
 * Audit trail for the password-recovery flow.
 *  - stage "requested": anonymous; logged when someone asks for a reset email.
 *  - stage "completed": requires the recovery session; logged after the new
 *    password has been saved.
 * Responses never reveal whether an account exists.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ ok: false }, { status: 403 });
  }

  const ip = extractClientIp(request) ?? "unknown";
  const body = await readJsonBody(request);
  const stage = isRecord(body) ? body.stage : undefined;

  if (stage === "requested") {
    if (!checkRateLimit(`pw-reset:requested:ip:${ip}`, 10, 10 * 60_000)) {
      return jsonNoStore({ ok: false }, { status: 429 });
    }

    const rawEmail = isRecord(body) && typeof body.email === "string" ? body.email : "";
    if (!isValidEmail(rawEmail)) {
      return jsonNoStore({ ok: true });
    }

    const email = normalizeEmail(rawEmail);
    if (!checkRateLimit(`pw-reset:requested:email:${email}`, 3, 60 * 60_000)) {
      return jsonNoStore({ ok: true });
    }

    await recordAuditLog({
      action: "AUTH_PASSWORD_RESET_REQUESTED",
      entityType: "auth",
      actorEmail: email,
      metadata: { stage: "requested" },
      ip: request,
    });

    return jsonNoStore({ ok: true });
  }

  if (stage === "completed") {
    try {
      const { user, profile } = await getSessionAndProfile();

      if (!user) {
        return jsonNoStore({ ok: false, error: "Authentication required." }, { status: 401 });
      }

      if (!checkRateLimit(`pw-reset:completed:user:${user.id}`, 10, 60 * 60_000)) {
        return jsonNoStore({ ok: false }, { status: 429 });
      }

      await recordAuditLog({
        action: "AUTH_PASSWORD_RESET",
        entityType: "auth",
        entityId: user.id,
        actorId: profile?.id ?? null,
        actorEmail: user.email ?? null,
        metadata: { stage: "completed", method: "recovery_link" },
        ip: request,
      });

      return jsonNoStore({ ok: true });
    } catch {
      return jsonNoStore({ ok: false, error: "Unable to record this right now." }, { status: 500 });
    }
  }

  return jsonNoStore({ ok: false, error: "Invalid request." }, { status: 400 });
}
