import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessAdmin,
  canAccessMember,
  isMemberStatus,
  isUserRole,
} from "@/lib/rbac";

/**
 * Protects /member/* and /admin/* only. Public routes never run this code,
 * which keeps them fast, indexable and inside Vercel's edge quotas.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return new NextResponse("Server configuration error.", { status: 500 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  /** Redirects while carrying over any refreshed session cookies. */
  const redirectTo = (path: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        target.searchParams.set(key, value);
      }
    }
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  const { pathname, search } = request.nextUrl;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  // 1. Authentication (getUser validates the JWT with Supabase Auth).
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectTo("/login", { next: `${pathname}${search}` });
  }

  // 2. Authorization from the profiles row (RLS lets users read their own).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !isUserRole(profile.role) ||
    !isMemberStatus(profile.status)
  ) {
    await supabase.auth.signOut();
    return redirectTo("/login", { error: "profile-missing" });
  }

  const { role, status } = profile;

  if (status === "suspended") {
    await supabase.auth.signOut();
    return redirectTo("/login", { error: "suspended" });
  }

  if (isAdminRoute) {
    if (canAccessAdmin(role, status)) return response;
    if (canAccessMember(role, status)) {
      return redirectTo("/member", { error: "forbidden" });
    }
    return redirectTo("/join", { notice: "pending-approval" });
  }

  if (canAccessMember(role, status)) return response;
  return redirectTo("/join", { notice: "pending-approval" });
}

export const config = {
  matcher: ["/member/:path*", "/admin/:path*"],
};
