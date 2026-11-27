"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveNews } from "@/app/(admin)/admin/_actions/news";
import { AuthAlert, inputClass, primaryButtonClass, Spinner } from "@/components/auth/ui";
import { CoverImageField, type CoverState } from "@/components/admin/CoverImageField";
import { describedBy, Field } from "@/components/public/FormField";
import { textareaClass } from "@/components/ui/styles";
import { discardUpload, uploadImage } from "@/lib/cover-upload";

export interface NewsFormValues {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  is_published: boolean;
  cover_url: string | null;
}

export function NewsForm({ initial, notice }: { initial: NewsFormValues; notice?: string }) {
  const router = useRouter();
  const editing = Boolean(initial.id);
  const [values, setValues] = useState(initial);
  const [cover, setCover] = useState<CoverState>({ kind: "keep" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    notice ? { tone: "success", text: notice } : null
  );
  const [saving, setSaving] = useState(false);

  function update<K extends keyof NewsFormValues>(key: K, value: NewsFormValues[K]) {
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
        const uploaded = await uploadImage("news", cover.blob, cover.extension);
        if ("error" in uploaded) {
          setMessage({ tone: "error", text: uploaded.error });
          return;
        }
        uploadedPath = uploaded.path;
        coverInput = { action: "set", path: uploaded.path };
      }

      const result = await saveNews({
        id: values.id,
        title: values.title,
        slug: values.slug,
        excerpt: values.excerpt,
        content: values.content,
        is_published: values.is_published,
        cover: coverInput,
      });

      if (!result.ok) {
        if (uploadedPath) await discardUpload(uploadedPath);
        setErrors(result.fieldErrors ?? {});
        setMessage({ tone: "error", text: result.error });
        const first = Object.keys(result.fieldErrors ?? {})[0];
        if (first) document.getElementById(`news-${first}`)?.focus();
        return;
      }

      if (!editing && result.data) {
        router.push(`/admin/news/${result.data.id}/edit?created=1`);
        return;
      }
      setCover({ kind: "keep" });
      setErrors({});
      setMessage({ tone: "success", text: result.message ?? "Article saved." });
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

      <Field id="news-title" label="Headline" required error={errors.title}>
        <input id="news-title" type="text" maxLength={150} value={values.title} onChange={(e) => update("title", e.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={describedBy("news-title", errors.title)} className={inputClass} />
      </Field>

      <Field id="news-slug" label="Web address (slug)" hint="Leave blank to create it from the headline." error={errors.slug}>
        <input id="news-slug" type="text" maxLength={80} value={values.slug} onChange={(e) => update("slug", e.target.value)} aria-describedby={describedBy("news-slug", errors.slug, "hint")} className={inputClass} />
      </Field>

      <Field id="news-excerpt" label="Summary" required hint={`${values.excerpt.length}/300 characters. Shown on cards and in search results.`} error={errors.excerpt}>
        <textarea id="news-excerpt" maxLength={300} value={values.excerpt} onChange={(e) => update("excerpt", e.target.value)} aria-invalid={Boolean(errors.excerpt)} aria-describedby={describedBy("news-excerpt", errors.excerpt, "hint")} className={`${textareaClass} min-h-[88px]`} />
      </Field>

      <Field id="news-content" label="Article" required hint="Separate paragraphs with a blank line." error={errors.content}>
        <textarea id="news-content" maxLength={20000} value={values.content} onChange={(e) => update("content", e.target.value)} aria-invalid={Boolean(errors.content)} aria-describedby={describedBy("news-content", errors.content, "hint")} className={`${textareaClass} min-h-[280px]`} />
      </Field>

      <CoverImageField id="news-cover" currentUrl={initial.cover_url} value={cover} onChange={setCover} disabled={saving} />

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={values.is_published} onChange={(e) => update("is_published", e.target.checked)} className="mt-1 h-4 w-4 rounded border-input accent-primary" />
        <span>
          <span className="font-semibold">Published</span>
          <span className="block text-muted-foreground">Published articles appear on the public News page.</span>
        </span>
      </label>

      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : editing ? (
          "Save article"
        ) : (
          "Create article"
        )}
      </button>
    </form>
  );
}
