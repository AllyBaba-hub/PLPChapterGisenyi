import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { checkRateLimit, isRecord, isSameOrigin, jsonNoStore, readJsonBody } from "@/lib/api-security";
import { authorizeApi } from "@/lib/rbac";
import { isUuid } from "@/lib/utils";
import { extractClientIp, recordAuditLog } from "@/services/audit";

export const dynamic = "force-dynamic";

interface Outcome {
  ok: boolean;
  http: number;
  message: string;
}

const OUTCOMES: Record<string, Outcome> = {
  registered: { ok: true, http: 200, message: "You are registered for this event." },
  already_registered: { ok: true, http: 200, message: "You are already registered for this event." },
  cancelled: { ok: true, http: 200, message: "Your registration was cancelled." },
  not_registered: { ok: true, http: 200, message: "You were not registered for this event." },
  full: { ok: false, http: 409, message: "This event is full." },
  closed: { ok: false, http: 409, message: "Registration for this event has closed." },
  not_found: { ok: false, http: 404, message: "We couldn't find that event." },
  forbidden: { ok: false, http: 403, message: "Only active members can register for events." },
};

/** Register for or cancel an event. Capacity is enforced atomically in the database. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const auth = await authorizeApi("member");
  if (!auth.ok) {
    return jsonNoStore({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!checkRateLimit(`events:register:${auth.user.id}`, 30, 60_000)) {
    return jsonNoStore({ ok: false, error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await readJsonBody(request);
  const eventId = isRecord(body) && typeof body.event_id === "string" ? body.event_id : "";
  const action = isRecord(body) ? body.action : undefined;

  if (!isUuid(eventId) || (action !== "register" && action !== "unregister")) {
    return jsonNoStore({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc(
    action === "register" ? "register_for_event" : "cancel_event_registration",
    { p_event_id: eventId }
  );

  if (error || typeof data !== "string") {
    console.error("[events/register] rpc failed:", error?.message ?? "unexpected result");
    return jsonNoStore(
      { ok: false, error: "We couldn't update your registration right now. Please try again." },
      { status: 500 }
    );
  }

  const outcome = OUTCOMES[data] ?? {
    ok: false,
    http: 500,
    message: "We couldn't update your registration right now. Please try again.",
  };

  if (data === "registered" || data === "cancelled") {
    await recordAuditLog({
      action: data === "registered" ? "EVENT_REGISTERED" : "EVENT_UNREGISTERED",
      entityType: "event",
      entityId: eventId,
      actorId: auth.profile.id,
      actorEmail: auth.profile.email,
      metadata: { member_code: auth.profile.member_code },
      ip: extractClientIp(request),
    });
    revalidatePath("/member", "layout");
  }

  return jsonNoStore({ ok: outcome.ok, status: data, message: outcome.message }, { status: outcome.http });
}
