"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAnnouncementPublished } from "@/app/(admin)/admin/_actions/announcements";
import { setEventPublished } from "@/app/(admin)/admin/_actions/events";
import { setNewsPublished } from "@/app/(admin)/admin/_actions/news";
import { Spinner } from "@/components/auth/ui";
import { buttonClass } from "@/components/ui/styles";

interface PublishToggleProps {
  kind: "event" | "news" | "announcement";
  id: string;
  published: boolean;
}

export function PublishToggle({ kind, id, published }: PublishToggleProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const action = kind === "event" ? setEventPublished : kind === "news" ? setNewsPublished : setAnnouncementPublished;
      const result = await action(id, !published);
      if (result.ok) router.refresh();
      else setError(result.error);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={toggle} disabled={busy} className={buttonClass("outline")}>
        {busy ? <Spinner /> : null}
        {published ? "Unpublish" : "Publish"}
      </button>
      {error ? (
        <span role="alert" className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
