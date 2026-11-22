"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  AuthAlert,
  labelClass,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  Spinner,
} from "@/components/auth/ui";
import { getPasswordChecks, validatePassword } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/client";

type Phase = "verifying" | "ready" | "invalid" | "config" | "success";

const RECOVERY_FLAG = "plp:recovery-session";
const VERIFY_TIMEOUT_MS = 3500;

function readRecoveryFlag(): boolean {
  try {
    return window.sessionStorage.getItem(RECOVERY_FLAG) === "1";
  } catch {
    return false;
  }
}

function writeRecoveryFlag(value: boolean): void {
  try {
    if (value) window.sessionStorage.setItem(RECOVERY_FLAG, "1");
    else window.sessionStorage.removeItem(RECOVERY_FLAG);
  } catch {
    // Storage can be unavailable (private mode); the flow still works.
  }
}

export function ResetPasswordForm() {
  const router = useRouter();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();

  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify the recovery link and wait for Supabase to establish the session.
  useEffect(() => {
    let active = true;
    let supabase: ReturnType<typeof createClient>;

    try {
      supabase = createClient();
    } catch {
      setPhase("config");
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    if (query.has("error") || query.has("error_description") || hash.has("error")) {
      setPhase("invalid");
      return;
    }

    const hasRecoveryParams =
      query.has("code") ||
      query.has("token_hash") ||
      hash.get("type") === "recovery" ||
      hash.has("access_token") ||
      readRecoveryFlag();

    const markReady = () => {
      if (!active) return;
      writeRecoveryFlag(true);
      setPhase((current) => (current === "verifying" ? "ready" : current));
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        markReady();
      } else if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session && hasRecoveryParams) {
        markReady();
      }
    });

    const timeout = window.setTimeout(async () => {
      if (!active) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session && hasRecoveryParams) markReady();
        else setPhase((current) => (current === "verifying" ? "invalid" : current));
      } catch {
        if (active) setPhase((current) => (current === "verifying" ? "invalid" : current));
      }
    }, VERIFY_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // After success, send the user to sign in with the new password.
  useEffect(() => {
    if (phase !== "success") return;
    const timer = window.setTimeout(() => router.replace("/login?notice=password-updated"), 2500);
    return () => window.clearTimeout(timer);
  }, [phase, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setPhase("config");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        if (updateError.code === "same_password") {
          setError("Choose a password that is different from your current one.");
        } else if (updateError.code === "weak_password") {
          setError("That password is too easy to guess. Try a longer or less common one.");
        } else if (updateError.code === "session_not_found" || updateError.name === "AuthSessionMissingError") {
          writeRecoveryFlag(false);
          setPhase("invalid");
        } else if (updateError.status === 429) {
          setError("Too many attempts. Please wait a few minutes and try again.");
        } else {
          setError("We couldn't update your password right now. Please try again.");
        }
        setLoading(false);
        return;
      }

      // Audit the completed reset while the recovery session is still active.
      try {
        await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "completed" }),
          credentials: "same-origin",
        });
      } catch {
        // The password is already changed; a logging failure must not hide that.
      }

      writeRecoveryFlag(false);
      await supabase.auth.signOut();
      setLoading(false);
      setPhase("success");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  if (phase === "verifying") {
    return (
      <div className="py-6 text-center" role="status" aria-live="polite">
        <Spinner className="mx-auto h-6 w-6 text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Verifying your reset link…</p>
      </div>
    );
  }

  if (phase === "config") {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl">Reset unavailable</h1>
        <div className="mt-4">
          <AuthAlert variant="error">
            Password reset is temporarily unavailable because the site isn&apos;t configured correctly.
            Please try again later or contact the chapter.
          </AuthAlert>
        </div>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl">Link expired or invalid</h1>
        <div className="mt-4 space-y-4">
          <AuthAlert variant="warning">
            This reset link has expired, was already used, or was opened in a different browser than the
            one you requested it from. Request a new link and open it in the same browser.
          </AuthAlert>
          <Link href="/forgot-password" className={`${primaryButtonClass} no-underline`}>
            Request a new link
          </Link>
          <Link href="/login" className={`${secondaryButtonClass} no-underline`}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl">Password updated</h1>
        <div className="mt-4 space-y-4">
          <AuthAlert variant="success">
            Your password has been changed. Taking you to the sign-in page…
          </AuthAlert>
          <Link href="/login?notice=password-updated" className={`${primaryButtonClass} no-underline`}>
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  const checks = getPasswordChecks(password);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a password you don&apos;t use anywhere else.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={loading}>
        {error ? (
          <AuthAlert variant="error" id={errorId}>
            {error}
          </AuthAlert>
        ) : null}

        <div>
          <label htmlFor={passwordId} className={labelClass}>
            New password
          </label>
          <PasswordInput
            id={passwordId}
            name="new-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            aria-describedby={error ? errorId : undefined}
          />
          <ul className="mt-2 space-y-1 text-xs" aria-label="Password requirements">
            {checks.map((check) => (
              <li
                key={check.id}
                className={check.passed ? "text-foreground" : "text-muted-foreground"}
              >
                <span aria-hidden="true" className={check.passed ? "text-success" : undefined}>
                  {check.passed ? "✓" : "•"}
                </span>{" "}
                {check.label}
                <span className="sr-only">{check.passed ? " (met)" : " (not met yet)"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label htmlFor={confirmId} className={labelClass}>
            Confirm new password
          </label>
          <PasswordInput
            id={confirmId}
            name="confirm-password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading}
            aria-describedby={error ? errorId : undefined}
          />
        </div>

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? (
            <>
              <Spinner />
              Updating…
            </>
          ) : (
            "Update password"
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
