"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AuthAlert } from "@/components/auth/ui";
import { buttonClass } from "@/components/ui/styles";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="w-full max-w-md space-y-4">
        <AuthAlert variant="error" title="Something went wrong">
          We couldn&apos;t load this page. Please try again in a moment.
        </AuthAlert>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className={buttonClass("primary")}>
            Try again
          </button>
          <Link href="/" className={buttonClass("outline")}>
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}
