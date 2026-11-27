import type { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-security";
import { resolvePostLoginPath } from "@/lib/auth-redirect";
import { canAccessAdmin, canAccessMember, getSessionAndProfile } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Session/status check: who is signed in, their role/status, and where to send them. */
export async function GET(request: NextRequest) {
  try {
    const { user, profile } = await getSessionAndProfile();

    if (!user) {
      return jsonNoStore({ authenticated: false, user: null, profile: null, redirectTo: null });
    }

    const next = request.nextUrl.searchParams.get("next");

    return jsonNoStore({
      authenticated: true,
      user: { id: user.id, email: user.email ?? null },
      profile: profile
        ? {
            full_name: profile.full_name,
            role: profile.role,
            status: profile.status,
            member_code: profile.member_code,
            avatar_url: profile.avatar_url,
          }
        : null,
      access: {
        member: profile ? canAccessMember(profile.role, profile.status) : false,
        admin: profile ? canAccessAdmin(profile.role, profile.status) : false,
      },
      redirectTo: resolvePostLoginPath(profile, next),
    });
  } catch {
    return jsonNoStore(
      { authenticated: false, error: "Unable to check the session right now." },
      { status: 500 }
    );
  }
}
