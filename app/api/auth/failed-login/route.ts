import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  isRecord,
  isSameOrigin,
  jsonNoStore,
  readJsonBody,
} from "@/lib/api-security";
import { isValidEmail, normalizeEmail } from "@/lib/auth-validation";
import { extractClientIp, recordAuditLog } from "@/services/audit";

export const dynamic = "force-dynamic";

/**
 * Records a failed sign-in attempt. The response is deliberately identical for
 * known and unknown accounts so it cannot be used to probe which emails exist.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ ok: false }, { status: 403 });
  }

  const ip = extractClientIp(request) ?? "unknown";
  if (!checkRateLimit(`failed-login:ip:${ip}`, 20, 60_000)) {
    return jsonNoStore({ ok: false }, { status: 429 });
  }

  const body = await readJsonBody(request);
  const rawEmail = isRecord(body) && typeof body.email === "string" ? body.email : "";

  if (!isValidEmail(rawEmail)) {
    return jsonNoStore({ ok: true });
  }

  const email = normalizeEmail(rawEmail);
  if (!checkRateLimit(`failed-login:email:${ip}:${email}`, 5, 60_000)) {
    return jsonNoStore({ ok: false }, { status: 429 });
  }

  await recordAuditLog({
    action: "AUTH_FAILED_LOGIN",
    entityType: "auth",
    actorEmail: email,
    metadata: {
      reason: "invalid_credentials",
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    },
    ip: request,
  });

  return jsonNoStore({ ok: true });
}
