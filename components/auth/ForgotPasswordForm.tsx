"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  AuthAlert,
  inputClass,
  labelClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  Spinner,
} from "@/components/auth/ui";
import { isValidEmail, normalizeEmail } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

function logResetRequest(email: string): void {
  try {
    void fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "requested", email }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Audit logging must never block the recovery flow.
  }
}

export function ForgotPasswordForm() {
  const emailId = useId();
  const errorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendResetEmail(target: string): Promise<boolean> {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setError("Password recovery is temporarily unavailable. Please try again later.");
      return false;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      logResetRequest(target);

      if (resetError) {
        if (resetError.status === 429 || resetError.code === "over_email_send_rate_limit") {
          setError("Too many reset emails were requested. Please wait a few minutes and try again.");
        } else {
          setError("We couldn't send the reset email right now. Please try again in a few minutes.");
        }
        return false;
      }
      return true;
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      return false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || cooldown > 0) return;

    setError(null);
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    const ok = await sendResetEmail(normalizedEmail);
    setLoading(false);

    if (ok) {
      setSentTo(normalizedEmail);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  async function handleResend() {
    if (!sentTo || loading || cooldown > 0) return;
    setError(null);
    setLoading(true);
    const ok = await sendResetEmail(sentTo);
    setLoading(false);
    if (ok) setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  if (sentTo) {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl">Check your email</h1>
        <div className="mt-4 space-y-4">
          <AuthAlert variant="success">
            If an account exists for <span className="font-semibold">{sentTo}</span>, we&apos;ve sent a
            link to reset your password. The link expires after a short time and works in the browser
            you used here.
          </AuthAlert>
          {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
          <p className="text-sm text-muted-foreground">
            Can&apos;t find it? Check your spam folder, or request another email.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={loading || cooldown > 0}
            className={secondaryButtonClass}
          >
            {loading ? (
              <>
                <Spinner />
                Sending…
              </>
            ) : cooldown > 0 ? (
              `Resend email in ${cooldown}s`
            ) : (
              "Resend email"
            )}
          </button>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className={linkClass}>
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email you use for your PLP Chapter Gisenyi account and we&apos;ll send you a reset
          link.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={loading}>
        {error ? (
          <AuthAlert variant="error" id={errorId}>
            {error}
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
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            aria-describedby={error ? errorId : undefined}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? (
            <>
              <Spinner />
              Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className={linkClass}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
