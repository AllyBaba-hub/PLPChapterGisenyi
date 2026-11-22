import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { isSafeInternalPath, resolvePostLoginPath } from "@/lib/auth-redirect";
import {
  firstParam,
  parseLoginError,
  parseLoginNotice,
  type LoginErrorCode,
} from "@/lib/auth-messages";
import { canAccessMember, getSessionAndProfile } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Sign in",
    description:
      "Sign in to the PLP Chapter Gisenyi member portal to manage your membership, events and announcements.",
    alternates: { canonical: "/login" },
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const nextCandidate = firstParam(params.next);
  const next = isSafeInternalPath(nextCandidate) ? nextCandidate : null;
  const notice = parseLoginNotice(params.notice);
  let error: LoginErrorCode | null = parseLoginError(params.error);

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let destination: string | null = null;

  if (!configured) {
    error = "config";
  } else if (!error) {
    try {
      const { user, profile } = await getSessionAndProfile();
      if (user && !profile) {
        error = "profile-missing";
      } else if (user && profile) {
        if (profile.status === "suspended") {
          error = "suspended";
        } else if (canAccessMember(profile.role, profile.status)) {
          destination = resolvePostLoginPath(profile, next);
        }
      }
    } catch {
      error = "config";
    }
  }

  if (destination) redirect(destination);

  return <LoginForm next={next} initialError={error} notice={notice} />;
}
