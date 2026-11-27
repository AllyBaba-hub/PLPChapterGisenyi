"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { createGalleryPhoto, createGalleryVideo } from "@/app/(admin)/admin/_actions/gallery";
import { AuthAlert, inputClass, primaryButtonClass, Spinner } from "@/components/auth/ui";
import { describedBy, Field } from "@/components/public/FormField";
import { selectClass } from "@/components/ui/styles";
import { discardUpload, uploadImage } from "@/lib/cover-upload";
import { compressImage, ImageCompressionError, validateImageFile } from "@/lib/image-compress";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { cn } from "@/lib/utils";

type Mode = "photo" | "video";

export function GalleryUploadForm({ events }: { events: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("photo");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [altText, setAltText] = useState("");
  const [eventId, setEventId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [step, setStep] = useState<"idle" | "compressing" | "uploading" | "saving">("idle");

  const busy = step !== "idle";

  function reset() {
    setTitle("");
    setCaption("");
    setAltText("");
    setEventId("");
    setVideoUrl("");
    setFile(null);
    setErrors({});
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage(null);
    setErrors({});

    const meta = { title, caption, alt_text: altText, event_id: eventId };
    let uploadedPath: string | null = null;

    try {
      if (mode === "photo") {
        if (!file) {
          setErrors({ file: "Choose a photo to upload." });
          return;
        }
        const problem = validateImageFile(file);
        if (problem) {
          setErrors({ file: problem });
          return;
        }
        if (title.trim().length < 2 || altText.trim().length < 5) {
          setErrors({
            ...(title.trim().length < 2 ? { title: "Enter a title." } : {}),
            ...(altText.trim().length < 5 ? { alt_text: "Describe the photo for screen readers (at least 5 characters)." } : {}),
          });
          return;
        }

        setStep("compressing");
        const compressed = await compressImage(file, { maxDimension: 1600, maxBytes: MAX_UPLOAD_BYTES });
        setStep("uploading");
        const uploaded = await uploadImage("gallery", compressed.blob, compressed.extension);
        if ("error" in uploaded) {
          setMessage({ tone: "error", text: uploaded.error });
          return;
        }
        uploadedPath = uploaded.path;

        setStep("saving");
        const result = await createGalleryPhoto(meta, uploaded.path);
        if (!result.ok) {
          await discardUpload(uploaded.path);
          setErrors(result.fieldErrors ?? {});
          setMessage({ tone: "error", text: result.error });
          return;
        }
        setMessage({ tone: "success", text: result.message ?? "Photo added." });
      } else {
        setStep("saving");
        const result = await createGalleryVideo(meta, videoUrl);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setMessage({ tone: "error", text: result.error });
          return;
        }
        setMessage({ tone: "success", text: result.message ?? "Video added." });
      }

      reset();
      router.refresh();
    } catch (error) {
      if (uploadedPath) await discardUpload(uploadedPath);
      setMessage({
        tone: "error",
        text: error instanceof ImageCompressionError ? error.message : "Something went wrong. Please try again.",
      });
    } finally {
      setStep("idle");
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-secondary"
    );

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={busy} className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Media type">
        <button type="button" aria-pressed={mode === "photo"} onClick={() => setMode("photo")} className={tabClass(mode === "photo")}>
          Photo
        </button>
        <button type="button" aria-pressed={mode === "video"} onClick={() => setMode("video")} className={tabClass(mode === "video")}>
          YouTube video
        </button>
      </div>

      {message ? <AuthAlert variant={message.tone === "error" ? "error" : "success"}>{message.text}</AuthAlert> : null}

      {mode === "photo" ? (
        <Field id="gallery-file" label="Photo" required hint="JPEG, PNG or WebP. Compressed to under 250 KB before upload." error={errors.file}>
          <input
            ref={fileRef}
            id="gallery-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-describedby={describedBy("gallery-file", errors.file, "hint")}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
        </Field>
      ) : (
        <Field id="gallery-url" label="YouTube link" required hint="Videos stay on YouTube; only the link is stored here." error={errors.url}>
          <input
            id="gallery-url"
            type="url"
            inputMode="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            aria-invalid={Boolean(errors.url)}
            aria-describedby={describedBy("gallery-url", errors.url, "hint")}
            className={inputClass}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </Field>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="gallery-title" label="Title" required error={errors.title}>
          <input id="gallery-title" type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={describedBy("gallery-title", errors.title)} className={inputClass} />
        </Field>
        <Field id="gallery-event" label="Related event" error={errors.event_id}>
          <select id="gallery-event" value={eventId} onChange={(e) => setEventId(e.target.value)} className={selectClass}>
            <option value="">None</option>
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="gallery-caption" label="Caption" error={errors.caption}>
        <input id="gallery-caption" type="text" maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} className={inputClass} />
      </Field>

      <Field
        id="gallery-alt_text"
        label={mode === "photo" ? "Description (alt text)" : "Description (alt text)"}
        required={mode === "photo"}
        hint="Describe what is shown, for screen readers and search engines."
        error={errors.alt_text}
      >
        <input id="gallery-alt_text" type="text" maxLength={200} value={altText} onChange={(e) => setAltText(e.target.value)} aria-invalid={Boolean(errors.alt_text)} aria-describedby={describedBy("gallery-alt_text", errors.alt_text, "hint")} className={inputClass} />
      </Field>

      <button type="submit" disabled={busy} className={primaryButtonClass}>
        {busy ? (
          <>
            <Spinner />
            {step === "compressing" ? "Preparing photo…" : step === "uploading" ? "Uploading…" : "Saving…"}
          </>
        ) : mode === "photo" ? (
          "Upload photo"
        ) : (
          "Add video"
        )}
      </button>
    </form>
  );
}
