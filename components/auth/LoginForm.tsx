"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  AuthAlert,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
  Spinner,
} from "@/components/auth/ui";
import {
  LOGIN_ERROR_MESSAGES,
  LOGIN_NOTICE_MESSAGES,
  type LoginErrorCode,
  type LoginNotice,
} from "@/lib/auth-messages";
import { isValidEmail, normalizeEmail } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  /** Already-validated internal path to return to after sign-in. */
  next: string | null;
  initialError: LoginErrorCode | null;
  notice: LoginNotice | null;
}

interface SessionResponse {
  authenticated: boolean;
  profile: { role: string; status: string } | null;
  redirectTo: string | null;
}

function reportFailedLogin(email: string): void {
  try {
    void fetch("/api/auth/failed-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting must never block or break the sign-in experience.
  }
}

export function LoginForm({ next, initialError, notice }: LoginFormProps) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const banner = initialError ? LOGIN_ERROR_MESSAGES[initialError] : null;
  const isConfigError = initialError === "config";

  // A lingering session for a suspended/orphaned account must not survive.
  useEffect(() => {
    if (initialError === "suspended" || initialError === "profile-missing") {
      void fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    }
  }, [initialError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || isConfigError) return;

    setFormError(null);
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setFormError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    if (!password) {
      setFormError("Enter your password.");
      return;
    }

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setFormError(LOGIN_ERROR_MESSAGES.config.body);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        if (error.code === "email_not_confirmed") {
          setFormError("Please confirm your email address using the link we sent, then sign in.");
        } else if (error.status === 429 || error.code === "over_request_rate_limit") {
          setFormError("Too many attempts. Please wait a few minutes and try again.");
        } else if (error.code === "invalid_credentials" || error.status === 400) {
          reportFailedLogin(normalizedEmail);
          setFormError("The email or password is incorrect.");
        } else {
          setFormError("We couldn't sign you in right now. Please try again.");
        }
        setLoading(false);
        return;
      }

      let destination: string = next ?? "/member";

      try {
        const response = await fetch(
          `/api/auth/session${next ? `?next=${encodeURIComponent(next)}` : ""}`,
          { cache: "no-store", credentials: "same-origin" }
        );

        if (response.ok) {
          const session = (await response.json()) as SessionResponse;

          if (!session.profile) {
            await supabase.auth.signOut();
            setFormError(LOGIN_ERROR_MESSAGES["profile-missing"].body);
            setLoading(false);
            return;
          }
          if (session.profile.status === "suspended") {
            await supabase.auth.signOut();
            setFormError(LOGIN_ERROR_MESSAGES.suspended.body);
            setLoading(false);
            return;
          }
          if (session.redirectTo) destination = session.redirectTo;
        }
      } catch {
        // Fall back to the default destination; middleware enforces access.
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access the PLP Chapter Gisenyi member portal.
        </p>
      </div>

      <div className="space-y-4">
        {banner ? (
          <AuthAlert variant={initialError === "suspended" ? "warning" : "error"} title={banner.title}>
            {banner.body}
          </AuthAlert>
        ) : null}
        {notice ? <AuthAlert variant="success">{LOGIN_NOTICE_MESSAGES[notice]}</AuthAlert> : null}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4" aria-busy={loading}>
        {formError ? (
          <AuthAlert variant="error" id={errorId}>
            {formError}
          </AuthAlert>
        ) : null}

        <div>
          <label htmlFor={emailId} className={labelClass}>
            Email address
          </label>
          <input
            ref={emailRef}
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || isConfigError}
            aria-describedby={formError ? errorId : undefined}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor={passwordId} className="text-sm font-medium text-foreground">
              Password
            </label>
            <Link href="/forgot-password" className={`text-sm ${linkClass}`}>
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id={passwordId}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || isConfigError}
            aria-describedby={formError ? errorId : undefined}
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" disabled={loading || isConfigError} className={primaryButtonClass}>
          {loading ? (
            <>
              <Spinner />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Not a member yet?{" "}
        <Link href="/join" className={linkClass}>
          Apply to join PLP Chapter Gisenyi
        </Link>
      </p>
    </div>
  );
}
