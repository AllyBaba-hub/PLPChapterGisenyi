"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { deleteAnnouncement, saveAnnouncement } from "@/app/(admin)/admin/_actions/announcements";
import { ActivityAlertButton } from "@/components/admin/ActivityAlertButton";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { AuthAlert, inputClass, primaryButtonClass, Spinner } from "@/components/auth/ui";
import { describedBy, Field } from "@/components/public/FormField";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass, selectClass, textareaClass } from "@/components/ui/styles";
import { formatDate, truncate } from "@/lib/utils";

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "important" | "urgent";
  is_published: boolean;
  created_at: string;
}

const PRIORITY_TONE: Record<AnnouncementRow["priority"], BadgeTone> = { normal: "muted", important: "warning", urgent: "danger" };

interface FormValues {
  id?: string;
  title: string;
  body: string;
  priority: AnnouncementRow["priority"];
  is_published: boolean;
}

function AnnouncementForm({ initial, onDone, onCancel }: { initial: FormValues; onDone: () => void; onCancel?: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const prefix = initial.id ? `ann-${initial.id}` : "ann-new";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveAnnouncement(values);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.error);
        return;
      }
      setErrors({});
      if (!initial.id) setValues({ title: "", body: "", priority: "normal", is_published: true });
      router.refresh();
      onDone();
    } catch {
      setMessage("We couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={saving} className="space-y-4">
      {message ? <AuthAlert variant="error">{message}</AuthAlert> : null}
      <Field id={`${prefix}-title`} label="Title" required error={errors.title}>
        <input id={`${prefix}-title`} type="text" maxLength={150} value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} aria-invalid={Boolean(errors.title)} aria-describedby={describedBy(`${prefix}-title`, errors.title)} className={inputClass} />
      </Field>
      <Field id={`${prefix}-body`} label="Message" required hint="Separate paragraphs with a blank line." error={errors.body}>
        <textarea id={`${prefix}-body`} maxLength={5000} value={values.body} onChange={(e) => setValues({ ...values, body: e.target.value })} aria-invalid={Boolean(errors.body)} aria-describedby={describedBy(`${prefix}-body`, errors.body, "hint")} className={textareaClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}-priority`} label="Priority" required>
          <select id={`${prefix}-priority`} value={values.priority} onChange={(e) => setValues({ ...values, priority: e.target.value as FormValues["priority"] })} className={selectClass}>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        <label className="flex items-end gap-3 pb-2 text-sm">
          <input type="checkbox" checked={values.is_published} onChange={(e) => setValues({ ...values, is_published: e.target.checked })} className="h-4 w-4 rounded border-input accent-primary" />
          <span className="font-semibold">Visible to members</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={initial.id ? buttonClass("primary") : primaryButtonClass}>
          {saving ? <Spinner /> : null}
          {initial.id ? "Save changes" : "Post announcement"}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonClass("outline")}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function AnnouncementManager({ items }: { items: AnnouncementRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <section aria-labelledby="new-announcement-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="new-announcement-heading" className="mb-4 text-lg sm:text-lg">
          New announcement
        </h2>
        <AnnouncementForm initial={{ title: "", body: "", priority: "normal", is_published: true }} onDone={() => undefined} />
      </section>

      <section aria-labelledby="all-announcements-heading">
        <h2 id="all-announcements-heading" className="mb-4 text-lg sm:text-lg">
          All announcements
        </h2>
        {items.length === 0 ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border bg-card p-5 shadow-sm">
                {editingId === item.id ? (
                  <AnnouncementForm
                    initial={{ id: item.id, title: item.title, body: item.body, priority: item.priority, is_published: item.is_published }}
                    onDone={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.is_published ? "success" : "muted"}>{item.is_published ? "Visible" : "Hidden"}</Badge>
                      <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority[0].toUpperCase() + item.priority.slice(1)}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-lg">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{truncate(item.body, 280)}</p>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <button type="button" onClick={() => setEditingId(item.id)} className={buttonClass("outline")}>
                        Edit
                      </button>
                      <PublishToggle kind="announcement" id={item.id} published={item.is_published} />
                      <ConfirmButton
                        label="Delete"
                        ariaLabel={`Delete announcement "${item.title}"`}
                        confirmLabel="Yes, delete"
                        onConfirm={() => deleteAnnouncement(item.id)}
                      />
                    </div>
                    <ActivityAlertButton
                      kind="announcement"
                      entityId={item.id}
                      subject={`${item.priority === "urgent" ? "Urgent: " : ""}${item.title}`}
                      title={item.title}
                      message={item.body}
                      priority={item.priority}
                      actionPath="/member/announcements"
                      actionLabel="Read the announcement"
                      disabledReason={item.is_published ? undefined : "Make the announcement visible to members before emailing it."}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
