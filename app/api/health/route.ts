import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { checkRateLimit, jsonNoStore } from "@/lib/api-security";
import { extractClientIp } from "@/services/audit";

export const dynamic = "force-dynamic";

/**
 * Lightweight liveness check that touches the database. A daily Vercel Cron (vercel.json)
 * calls it so the free Supabase project is never idle long enough to be paused.
 * It exposes no data and no error details.
 */
export async function GET(request: NextRequest) {
  const ip = extractClientIp(request) ?? "unknown";
  if (!checkRateLimit(`health:${ip}`, 30, 60_000)) {
    return jsonNoStore({ ok: false }, { status: 429 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return jsonNoStore({ ok: false, database: "not configured" }, { status: 503 });
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });

  const started = Date.now();
  const { error } = await client.from("chapter_settings").select("id").eq("id", 1).limit(1);

  if (error) {
    console.error("[health] database check failed:", error.message);
    return jsonNoStore({ ok: false, database: "unavailable" }, { status: 503 });
  }

  return jsonNoStore({
    ok: true,
    database: "up",
    latency_ms: Date.now() - started,
    checked_at: new Date().toISOString(),
  });
}
