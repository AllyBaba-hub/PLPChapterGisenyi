"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { deleteGalleryItem, updateGalleryItem } from "@/app/(admin)/admin/_actions/gallery";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AuthAlert, inputClass, Spinner } from "@/components/auth/ui";
import { describedBy, Field } from "@/components/public/FormField";
import { Badge } from "@/components/ui/Badge";
import { buttonClass, selectClass } from "@/components/ui/styles";
import { formatDate } from "@/lib/utils";
import { parseYouTubeId, youTubeThumbnailUrl } from "@/lib/youtube";

export interface GalleryRow {
  id: string;
  title: string;
  caption: string | null;
  alt_text: string;
  media_type: "photo" | "video";
  media_url: string;
  event_id: string | null;
  created_at: string;
}

export function GalleryItemCard({ item, events }: { item: GalleryRow; events: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [altText, setAltText] = useState(item.alt_text);
  const [eventId, setEventId] = useState(item.event_id ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const videoId = item.media_type === "video" ? parseYouTubeId(item.media_url) : null;
  const thumb = item.media_type === "photo" ? item.media_url : videoId ? youTubeThumbnailUrl(videoId) : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await updateGalleryItem(item.id, { title, caption, alt_text: altText, event_id: eventId });
      if (result.ok) {
        setErrors({});
        setEditing(false);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.error);
      }
    } catch {
      setMessage("We couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={item.alt_text} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-secondary text-sm text-muted-foreground">No preview</div>
      )}

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={item.media_type === "photo" ? "primary" : "warning"}>{item.media_type === "photo" ? "Photo" : "Video"}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
        </div>
        <p className="font-semibold leading-snug">{item.title}</p>
        {item.caption ? <p className="text-sm text-muted-foreground">{item.caption}</p> : null}

        {editing ? (
          <form onSubmit={save} noValidate className="space-y-3 border-t pt-3">
            {message ? <AuthAlert variant="error">{message}</AuthAlert> : null}
            <Field id={`g-title-${item.id}`} label="Title" required error={errors.title}>
              <input id={`g-title-${item.id}`} type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} aria-describedby={describedBy(`g-title-${item.id}`, errors.title)} className={inputClass} />
            </Field>
            <Field id={`g-caption-${item.id}`} label="Caption">
              <input id={`g-caption-${item.id}`} type="text" maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} className={inputClass} />
            </Field>
            <Field id={`g-alt-${item.id}`} label="Description (alt text)" required error={errors.alt_text}>
              <input id={`g-alt-${item.id}`} type="text" maxLength={200} value={altText} onChange={(e) => setAltText(e.target.value)} aria-describedby={describedBy(`g-alt-${item.id}`, errors.alt_text)} className={inputClass} />
            </Field>
            <Field id={`g-event-${item.id}`} label="Related event">
              <select id={`g-event-${item.id}`} value={eventId} onChange={(e) => setEventId(e.target.value)} className={selectClass}>
                <option value="">None</option>
                {events.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className={buttonClass("primary")}>
                {saving ? <Spinner /> : null}
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className={buttonClass("outline")}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <button type="button" onClick={() => setEditing(true)} className={buttonClass("outline")}>
              Edit details
            </button>
            <ConfirmButton
              label="Delete"
              ariaLabel={`Delete gallery item "${item.title}"`}
              confirmLabel="Yes, delete"
              onConfirm={() => deleteGalleryItem(item.id)}
            />
          </div>
        )}
      </div>
    </li>
  );
}
