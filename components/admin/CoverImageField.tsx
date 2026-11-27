"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/styles";
import { compressImage, ImageCompressionError, validateImageFile } from "@/lib/image-compress";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";

export type CoverState =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "new"; blob: Blob; extension: "webp" | "jpg"; previewUrl: string };

interface CoverImageFieldProps {
  id: string;
  label?: string;
  currentUrl: string | null;
  value: CoverState;
  onChange: (state: CoverState) => void;
  disabled?: boolean;
}

/** Picks and compresses a cover photo in the browser (≤ 250 KB). The upload happens when the form is saved. */
export function CoverImageField({ id, label = "Cover image", currentUrl, value, onChange, disabled }: CoverImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    previewRef.current = value.kind === "new" ? value.previewUrl : null;
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const shown = value.kind === "new" ? value.previewUrl : value.kind === "keep" ? currentUrl : null;

  async function handleFile(file: File) {
    setError(null);
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setProcessing(true);
    try {
      const result = await compressImage(file, { maxDimension: 1600, maxBytes: MAX_UPLOAD_BYTES });
      if (value.kind === "new") URL.revokeObjectURL(value.previewUrl);
      onChange({ kind: "new", blob: result.blob, extension: result.extension, previewUrl: URL.createObjectURL(result.blob) });
    } catch (err) {
      setError(err instanceof ImageCompressionError ? err.message : "We couldn't process that image.");
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-foreground">
        {label} <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
      <div className="overflow-hidden rounded-lg border bg-secondary/50">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Cover preview" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/9] items-center justify-center text-sm text-muted-foreground">
            {value.kind === "remove" ? "The cover image will be removed when you save." : "No cover image"}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={disabled || processing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <label htmlFor={id} className={`${buttonClass("outline")} cursor-pointer ${disabled || processing ? "pointer-events-none opacity-60" : ""}`}>
          {processing ? "Preparing…" : shown ? "Change image" : "Choose image"}
        </label>
        {value.kind === "remove" ? (
          <button type="button" onClick={() => onChange({ kind: "keep" })} className={buttonClass("ghost")} disabled={disabled}>
            Undo remove
          </button>
        ) : shown ? (
          <button
            type="button"
            onClick={() => {
              if (value.kind === "new") URL.revokeObjectURL(value.previewUrl);
              onChange(currentUrl && value.kind === "new" ? { kind: "keep" } : { kind: "remove" });
            }}
            className={buttonClass("ghost")}
            disabled={disabled}
          >
            {value.kind === "new" && currentUrl ? "Discard new image" : "Remove image"}
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        JPEG, PNG or WebP. Images are resized and compressed to under 250 KB automatically.
      </p>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
