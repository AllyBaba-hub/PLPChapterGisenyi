import type { NextRequest } from "next/server";
import { checkRateLimit, jsonNoStore } from "@/lib/api-security";
import { searchTerm } from "@/lib/admin-query";
import { authorizeApi, isMemberStatus, isUserRole } from "@/lib/rbac";
import { extractClientIp, recordAuditLog } from "@/services/audit";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "member_code",
  "full_name",
  "email",
  "phone",
  "sector_or_cell",
  "school_or_occupation",
  "role",
  "status",
  "joined_at",
  "email_notifications",
] as const;

/** Prevents spreadsheet formula injection from user-entered text. */
function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV export of the member roster (admins only). Honors the same filters as /admin/members. */
export async function GET(request: NextRequest) {
  const auth = await authorizeApi("admin");
  if (!auth.ok) return jsonNoStore({ ok: false, error: auth.error }, { status: auth.status });

  if (!checkRateLimit(`members:export:${auth.user.id}`, 10, 60 * 60_000)) {
    return jsonNoStore({ ok: false, error: "Too many exports. Please try again later." }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "";
  const q = searchTerm(params.get("q") ?? "");

  let query = auth.supabase
    .from("profiles")
    .select(COLUMNS.join(", "))
    .order("full_name", { ascending: true })
    .limit(5000);

  if (isUserRole(role)) query = query.eq("role", role);
  else query = query.in("role", ["member", "admin", "super_admin"]);
  if (isMemberStatus(status)) query = query.eq("status", status);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,member_code.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[members/export]", error.message);
    return jsonNoStore({ ok: false, error: "We couldn't export the roster right now." }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const csv = [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(","))].join("\r\n");

  await recordAuditLog({
    action: "MEMBERS_EXPORTED",
    entityType: "member",
    actorId: auth.profile.id,
    actorEmail: auth.profile.email,
    metadata: { rows: rows.length, role: role || null, status: status || null, search: q || null },
    ip: extractClientIp(request),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plp-gisenyi-members-${stamp}.csv"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
