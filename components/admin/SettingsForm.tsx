"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveSettings } from "@/app/(admin)/admin/_actions/settings";
import { AuthAlert, inputClass, primaryButtonClass, Spinner } from "@/components/auth/ui";
import { describedBy, Field } from "@/components/public/FormField";
import { textareaClass } from "@/components/ui/styles";
import { SOCIAL_KEYS } from "@/lib/admin-rules";
import { socialLabel } from "@/lib/utils";

export interface SettingsValues {
  chapter_name: string;
  parent_organization: string;
  district_location: string;
  contact_email: string;
  contact_phone: string;
  about_summary: string;
  applications_open: boolean;
  auto_email_notifications: boolean;
  social_links: Record<string, string>;
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
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
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveSettings(values);
      if (result.ok) {
        setErrors({});
        setMessage({ tone: "success", text: result.message ?? "Settings saved." });
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage({ tone: "error", text: result.error });
        const first = Object.keys(result.fieldErrors ?? {})[0];
        if (first) document.getElementById(`settings-${first}`)?.focus();
      }
    } catch {
      setMessage({ tone: "error", text: "We couldn't reach the server. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const text = (key: keyof Omit<SettingsValues, "applications_open" | "auto_email_notifications" | "social_links" | "about_summary">, label: string, type = "text", required = true) => (
    <Field id={`settings-${key}`} label={label} required={required} error={errors[key]}>
      <input
        id={`settings-${key}`}
        type={type}
        value={values[key]}
        onChange={(e) => update(key, e.target.value)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={describedBy(`settings-${key}`, errors[key])}
        className={inputClass}
      />
    </Field>
  );

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={saving} className="space-y-8">
      {message ? <AuthAlert variant={message.tone === "error" ? "error" : "success"}>{message.text}</AuthAlert> : null}

      <fieldset className="space-y-5">
        <legend className="mb-1 text-lg font-semibold tracking-tight">Chapter identity</legend>
        {text("chapter_name", "Chapter name")}
        {text("parent_organization", "Parent organization")}
        {text("district_location", "Location")}
        <Field id="settings-about_summary" label="About summary" required hint={`${values.about_summary.length}/600 characters. Used on the home page, in search results and in structured data.`} error={errors.about_summary}>
          <textarea id="settings-about_summary" maxLength={600} value={values.about_summary} onChange={(e) => update("about_summary", e.target.value)} aria-invalid={Boolean(errors.about_summary)} aria-describedby={describedBy("settings-about_summary", errors.about_summary, "hint")} className={textareaClass} />
        </Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 text-lg font-semibold tracking-tight">Contact details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("contact_email", "Contact email", "email")}
          {text("contact_phone", "Contact phone", "tel", false)}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 text-lg font-semibold tracking-tight">Social links</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {SOCIAL_KEYS.map((key) => (
            <Field key={key} id={`settings-social_${key}`} label={socialLabel(key)} error={errors[`social_${key}`]}>
              <input
                id={`settings-social_${key}`}
                type="url"
                inputMode="url"
                value={values.social_links[key] ?? ""}
                onChange={(e) => update("social_links", { ...values.social_links, [key]: e.target.value })}
                aria-invalid={Boolean(errors[`social_${key}`])}
                aria-describedby={describedBy(`settings-social_${key}`, errors[`social_${key}`])}
                className={inputClass}
                placeholder="https://"
              />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-semibold tracking-tight">Preferences</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={values.applications_open} onChange={(e) => update("applications_open", e.target.checked)} className="mt-1 h-4 w-4 rounded border-input accent-primary" />
          <span>
            <span className="font-semibold">Accept new membership applications</span>
            <span className="block text-muted-foreground">When off, the Join page shows that applications are closed.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={values.auto_email_notifications} onChange={(e) => update("auto_email_notifications", e.target.checked)} className="mt-1 h-4 w-4 rounded border-input accent-primary" />
          <span>
            <span className="font-semibold">Pre-select email notifications</span>
            <span className="block text-muted-foreground">New decisions and alerts start with the &ldquo;email members&rdquo; option switched on. You can always change it per action.</span>
          </span>
        </label>
      </fieldset>

      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? (
          <>
            <Spinner />
            Saving…
          </>
        ) : (
          "Save settings"
        )}
      </button>
    </form>
  );
}
