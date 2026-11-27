"use client";

import { useEffect } from "react";
import { AuthAlert } from "@/components/auth/ui";
import { buttonClass } from "@/components/ui/styles";

export default function MemberError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[member portal]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <AuthAlert variant="error" title="Something went wrong">
        We couldn&apos;t load this page. Check your connection and try again. If it keeps happening, contact the chapter.
      </AuthAlert>
      <button type="button" onClick={reset} className={buttonClass("primary")}>
        Try again
      </button>
    </div>
  );
}
