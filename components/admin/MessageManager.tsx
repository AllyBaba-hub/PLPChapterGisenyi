"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteMessage, saveMessageNotes, setMessageStatus, type MessageStatus } from "@/app/(admin)/admin/_actions/messages";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AuthAlert, Spinner } from "@/components/auth/ui";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass, textareaClass } from "@/components/ui/styles";
import { cn, formatDate } from "@/lib/utils";

export interface MessageRow {
  id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  admin_notes: string | null;
  created_at: string;
}

const TONES: Record<MessageStatus, BadgeTone> = { unread: "primary", read: "muted", replied: "success", archived: "muted" };
const LABELS: Record<MessageStatus, string> = { unread: "Unread", read: "Read", replied: "Replied", archived: "Archived" };

function MessageCard({ message }: { message: MessageRow }) {
  const router = useRouter();
  const [status, setStatus] = useState<MessageStatus>(message.status);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(message.admin_notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function changeStatus(next: MessageStatus) {
    const previous = status;
    setStatus(next);
    setBusy(next);
    setNotice(null);
    const result = await setMessageStatus(message.id, next).catch(() => ({ ok: false as const, error: "We couldn't reach the server." }));
    setBusy(null);
    if (!result.ok) {
      setStatus(previous);
      setNotice({ tone: "error", text: result.error });
      return;
    }
    router.refresh();
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening an unread message marks it as read.
    if (next && status === "unread") void changeStatus("read");
  }

  async function saveNotes() {
    setBusy("notes");
    setNotice(null);
    const result = await saveMessageNotes(message.id, notes).catch(() => ({ ok: false as const, error: "We couldn't reach the server." }));
    setBusy(null);
    setNotice({ tone: result.ok ? "success" : "error", text: result.ok ? (result.message ?? "Saved.") : result.error });
  }

  const mailto = `mailto:${message.sender_email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`;

  return (
    <li className={cn("rounded-xl border bg-card shadow-sm", status === "unread" && "border-primary/40 ring-1 ring-primary/20")}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-start justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block font-semibold">{message.subject}</span>
          <span className="block text-sm text-muted-foreground">
            {message.sender_name} · {message.sender_email}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Badge tone={TONES[status]}>{LABELS[status]}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(message.created_at)}</span>
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t p-4">
          <p className="whitespace-pre-line text-sm leading-6">{message.message}</p>
          {message.sender_phone ? <p className="text-sm text-muted-foreground">Phone: {message.sender_phone}</p> : null}

          {notice ? <AuthAlert variant={notice.tone === "error" ? "error" : "success"}>{notice.text}</AuthAlert> : null}

          <div className="flex flex-wrap gap-2">
            <a href={mailto} className={buttonClass("primary")}>
              Reply by email
            </a>
            {(["replied", "read", "unread", "archived"] as const)
              .filter((value) => value !== status)
              .map((value) => (
                <button key={value} type="button" onClick={() => changeStatus(value)} disabled={busy !== null} className={buttonClass("outline")}>
                  {busy === value ? <Spinner /> : null}
                  Mark as {LABELS[value].toLowerCase()}
                </button>
              ))}
          </div>

          <div>
            <label htmlFor={`notes-${message.id}`} className="mb-1.5 block text-sm font-medium">
              Admin notes <span className="font-normal text-muted-foreground">(only visible to admins)</span>
            </label>
            <textarea id={`notes-${message.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className={`${textareaClass} min-h-[88px]`} />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={saveNotes} disabled={busy !== null} className={buttonClass("outline")}>
                {busy === "notes" ? <Spinner /> : null}
                Save notes
              </button>
              <ConfirmButton
                label="Delete message"
                ariaLabel={`Delete message "${message.subject}"`}
                confirmLabel="Yes, delete message"
                onConfirm={() => deleteMessage(message.id)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function MessageManager({ messages }: { messages: MessageRow[] }) {
  return (
    <ul className="space-y-3">
      {messages.map((message) => (
        <MessageCard key={message.id} message={message} />
      ))}
    </ul>
  );
}
