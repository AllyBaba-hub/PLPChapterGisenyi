import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin, jsonNoStore } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Signs the current user out and clears the Supabase session cookies. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return jsonNoStore({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const isFormPost = (request.headers.get("content-type") ?? "").includes(
    "application/x-www-form-urlencoded"
  );

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    if (isFormPost) {
      return NextResponse.redirect(new URL("/login", request.url), 303);
    }
    return jsonNoStore({ ok: false, error: "Unable to sign out right now." }, { status: 500 });
  }

  if (isFormPost) {
    const redirect = NextResponse.redirect(new URL("/login?notice=signed-out", request.url), 303);
    redirect.headers.set("Cache-Control", "no-store, max-age=0");
    return redirect;
  }

  return jsonNoStore({ ok: true });
}
