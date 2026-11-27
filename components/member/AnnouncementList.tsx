"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { markAllAnnouncementsRead, markAnnouncementRead } from "@/app/(member)/member/actions";
import { AnnouncementReadToggle } from "@/components/member/AnnouncementReadToggle";
import { TextContent } from "@/components/public/TextContent";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/styles";
import type { AnnouncementPriority, AnnouncementView } from "@/lib/member-data";
import { cn, formatDate, truncate } from "@/lib/utils";

const PRIORITY: Record<AnnouncementPriority, { label: string; tone: BadgeTone } | null> = {
  normal: null,
  important: { label: "Important", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
};

const PREVIEW_LENGTH = 220;

export function AnnouncementList({ items }: { items: AnnouncementView[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [readMap, setReadMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.is_read]))
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unread = items.filter((item) => !readMap[item.id]).length;
  const elements = useRef(new Map<string, HTMLElement>());
  const readRef = useRef(readMap);
  readRef.current = readMap;

  async function setRead(id: string, read: boolean) {
    const previous = readMap[id];
    setReadMap((current) => ({ ...current, [id]: read }));
    setBusyId(id);
    setError(null);
    const result = await markAnnouncementRead(id, read);
    setBusyId(null);
    if (!result.ok) {
      setReadMap((current) => ({ ...current, [id]: previous }));
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  // Short announcements are fully visible, so seeing them for a moment counts as reading them.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const timers = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.announcementId;
          if (!id) continue;
          if (entry.isIntersecting && !readRef.current[id]) {
            if (!timers.has(id)) {
              timers.set(
                id,
                window.setTimeout(() => {
                  timers.delete(id);
                  if (!readRef.current[id]) void setRead(id, true);
                }, 1500)
              );
            }
          } else if (timers.has(id)) {
            window.clearTimeout(timers.get(id));
            timers.delete(id);
          }
        }
      },
      { threshold: 0.6 }
    );

    for (const item of items) {
      const element = elements.current.get(item.id);
      if (element && item.body.length <= PREVIEW_LENGTH && !item.is_read) observer.observe(element);
    }

    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function toggleExpanded(item: AnnouncementView) {
    const next = !expanded[item.id];
    setExpanded((current) => ({ ...current, [item.id]: next }));
    // Opening an unread announcement counts as reading it.
    if (next && !readMap[item.id]) void setRead(item.id, true);
  }

  async function markAll() {
    setError(null);
    const snapshot = readMap;
    setReadMap(Object.fromEntries(items.map((item) => [item.id, true])));
    const result = await markAllAnnouncementsRead();
    if (!result.ok) {
      setReadMap(snapshot);
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread > 0 ? `${unread} unread announcement${unread === 1 ? "" : "s"}` : "You are all caught up."}
        </p>
        {unread > 0 ? (
          <button type="button" onClick={markAll} disabled={isPending} className={buttonClass("outline")}>
            Mark all as read
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="space-y-4">
        {items.map((item) => {
          const isRead = readMap[item.id];
          const priority = PRIORITY[item.priority];
          const long = item.body.length > PREVIEW_LENGTH;
          const open = expanded[item.id] || !long;

          return (
            <li key={item.id}>
              <article
                data-announcement-id={item.id}
                ref={(node) => {
                  if (node) elements.current.set(item.id, node);
                  else elements.current.delete(item.id);
                }}
                className={cn(
                  "rounded-xl border bg-card p-5 shadow-sm",
                  !isRead && "border-primary/40 ring-1 ring-primary/20"
                )}
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!isRead ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
                          Unread
                        </span>
                      ) : null}
                      {priority ? <Badge tone={priority.tone}>{priority.label}</Badge> : null}
                      <time dateTime={item.created_at} className="text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                      </time>
                    </div>
                    <h2 className="mt-2 text-lg sm:text-lg">{item.title}</h2>
                  </div>
                  <AnnouncementReadToggle
                    isRead={isRead}
                    pending={busyId === item.id}
                    onToggle={() => setRead(item.id, !isRead)}
                    title={item.title}
                  />
                </header>

                <div className="mt-3 text-sm">
                  {open ? <TextContent text={item.body} className="text-sm leading-6" /> : <p className="leading-6">{truncate(item.body, PREVIEW_LENGTH)}</p>}
                </div>

                {long ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item)}
                    aria-expanded={Boolean(expanded[item.id])}
                    className="mt-3 rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {expanded[item.id] ? "Show less" : "Read more"}
                  </button>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
