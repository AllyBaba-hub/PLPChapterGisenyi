"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveEvent } from "@/app/(admin)/admin/_actions/events";
import { AuthAlert, inputClass, primaryButtonClass, Spinner } from "@/components/auth/ui";
import { CoverImageField, type CoverState } from "@/components/admin/CoverImageField";
import { describedBy, Field } from "@/components/public/FormField";
import { textareaClass } from "@/components/ui/styles";
import { discardUpload, uploadImage } from "@/lib/cover-upload";

export interface EventFormValues {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  location: string;
  start_local: string;
  end_local: string;
  max_capacity: string;
  is_published: boolean;
  cover_url: string | null;
}

export function EventForm({ initial, notice }: { initial: EventFormValues; notice?: string }) {
  const router = useRouter();
  const editing = Boolean(initial.id);
  const [values, setValues] = useState(initial);
  const [cover, setCover] = useState<CoverState>({ kind: "keep" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    notice ? { tone: "success", text: notice } : null
  );
  const [saving, setSaving] = useState(false);

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const { [key]: _removed, ...rest } = current;
      void _removed;
      return rest;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setMessage(null);
    setSaving(true);

    let uploadedPath: string | null = null;
    try {
      let coverInput: { action: "keep" | "remove" | "set"; path?: string } = { action: cover.kind === "new" ? "set" : cover.kind };

      if (cover.kind === "new") {
        const uploaded = await uploadImage("events", cover.blob, cover.extension);
        if ("error" in uploaded) {
          setMessage({ tone: "error", text: uploaded.error });
          return;
        }
        uploadedPath = uploaded.path;
        coverInput = { action: "set", path: uploaded.path };
      }

      const result = await saveEvent({
        id: values.id,
        title: values.title,
        slug: values.slug,
        summary: values.summary,
        description: values.description,
        location: values.location,
        start_local: values.start_local,
        end_local: values.end_local,
        max_capacity: values.max_capacity,
        is_published: values.is_published,
        cover: coverInput,
      });

      if (!result.ok) {
        if (uploadedPath) await discardUpload(uploadedPath);
        setErrors(result.fieldErrors ?? {});
        setMessage({ tone: "error", text: result.error });
        const first = Object.keys(result.fieldErrors ?? {})[0];
        if (first) document.getElementById(`event-${first}`)?.focus();
        return;
      }

      if (!editing && result.data) {
        router.push(`/admin/events/${result.data.id}/edit?created=1`);
        return;
      }
      setCover({ kind: "keep" });
      setErrors({});
      setMessage({ tone: "success", text: result.message ?? "Event saved." });
      router.refresh();
    } catch {
      if (uploadedPath) await discardUpload(uploadedPath);
      setMessage({ tone: "error", text: "We couldn't reach the server. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={saving} className="space-y-6">
      {message ? <AuthAlert variant={message.tone === "error" ? "error" : "success"}>{message.text}</AuthAlert> : null}

      <Field id="event-title" label="Title" required error={errors.title}>
        <input id="event-title" type="text" maxLength={150} value={values.title} onChange={(e) => update("title", e.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={describedBy("event-title", errors.title)} className={inputClass} />
      </Field>

      <Field id="event-slug" label="Web address (slug)" hint="Leave blank to create it from the title, e.g. peace-day-2026." error={errors.slug}>
        <input id="event-slug" type="text" maxLength={80} value={values.slug} onChange={(e) => update("slug", e.target.value)} aria-describedby={describedBy("event-slug", errors.slug, "hint")} className={inputClass} />
      </Field>

      <Field id="event-summary" label="Short summary" required hint={`${values.summary.length}/300 characters. Shown on cards and in search results.`} error={errors.summary}>
        <textarea id="event-summary" maxLength={300} value={values.summary} onChange={(e) => update("summary", e.target.value)} aria-invalid={Boolean(errors.summary)} aria-describedby={describedBy("event-summary", errors.summary, "hint")} className={`${textareaClass} min-h-[88px]`} />
      </Field>

      <Field id="event-description" label="Full description" required hint="Separate paragraphs with a blank line." error={errors.description}>
        <textarea id="event-description" maxLength={10000} value={values.description} onChange={(e) => update("description", e.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={describedBy("event-description", errors.description, "hint")} className={`${textareaClass} min-h-[200px]`} />
      </Field>

      <Field id="event-location" label="Location" required error={errors.location}>
        <input id="event-location" type="text" maxLength={200} value={values.location} onChange={(e) => update("location", e.target.value)} aria-invalid={Boolean(errors.location)} aria-describedby={describedBy("event-location", errors.location)} className={inputClass} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="event-start_local" label="Starts" required hint="Rwanda time (CAT)" error={errors.start_local}>
          <input id="event-start_local" type="datetime-local" value={values.start_local} onChange={(e) => update("start_local", e.target.value)} aria-invalid={Boolean(errors.start_local)} aria-describedby={describedBy("event-start_local", errors.start_local, "hint")} className={inputClass} />
        </Field>
        <Field id="event-end_local" label="Ends" hint="Rwanda time (CAT)" error={errors.end_local}>
          <input id="event-end_local" type="datetime-local" value={values.end_local} onChange={(e) => update("end_local", e.target.value)} aria-invalid={Boolean(errors.end_local)} aria-describedby={describedBy("event-end_local", errors.end_local, "hint")} className={inputClass} />
        </Field>
        <Field id="event-max_capacity" label="Capacity" hint="Blank means no limit." error={errors.max_capacity}>
          <input id="event-max_capacity" type="number" inputMode="numeric" min={1} max={100000} value={values.max_capacity} onChange={(e) => update("max_capacity", e.target.value)} aria-invalid={Boolean(errors.max_capacity)} aria-describedby={describedBy("event-max_capacity", errors.max_capacity, "hint")} className={inputClass} />
        </Field>
      </div>

      <CoverImageField id="event-cover" currentUrl={initial.cover_url} value={cover} onChange={setCover} disabled={saving} />

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={values.is_published} onChange={(e) => update("is_published", e.target.checked)} className="mt-1 h-4 w-4 rounded border-input accent-primary" />
        <span>
          <span className="font-semibold">Published</span>
          <span className="block text-muted-foreground">Published events appear on the public site and in the member portal.</span>
        </span>
      </label>

      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : editing ? (
          "Save event"
        ) : (
          "Create event"
        )}
      </button>
    </form>
  );
}
