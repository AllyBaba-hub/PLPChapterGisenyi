"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { approveApplication, rejectApplication, updateApplicationNotes } from "@/app/(admin)/admin/_actions/applications";
import { AuthAlert, Spinner } from "@/components/auth/ui";
import { buttonClass, textareaClass } from "@/components/ui/styles";
import { sendAccountNoticeAndLog } from "@/lib/admin-notify";

interface ApplicationReviewActionsProps {
  application: {
    id: string;
    status: "pending" | "approved" | "rejected";
    review_notes: string | null;
  };
  notifyDefault: boolean;
}

type Busy = "approve" | "reject" | "notes" | null;

export function ApplicationReviewActions({ application, notifyDefault }: ApplicationReviewActionsProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(application.review_notes ?? "");
  const [notify, setNotify] = useState(notifyDefault);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [notices, setNotices] = useState<Array<{ tone: "success" | "error" | "warning"; text: string }>>([]);

  const reviewed = application.status !== "pending";

  async function approve() {
    setBusy("approve");
    setNotices([]);
    try {
      const result = await approveApplication(application.id, notes);
      if (!result.ok) {
        setNotices([{ tone: "error", text: result.error }]);
        return;
      }
      const next: typeof notices = [{ tone: result.data?.linkedAccount === false ? "warning" : "success", text: result.message ?? "Approved." }];
      if (notify && result.data) {
        const email = await sendAccountNoticeAndLog(
          { kind: "application_approved", to: result.data.email, name: result.data.name, memberCode: result.data.memberCode },
          { type: "application", id: application.id }
        );
        next.push({ tone: email.sent ? "success" : "warning", text: email.message });
      }
      setNotices(next);
      router.refresh();
    } catch {
      setNotices([{ tone: "error", text: "We couldn't reach the server. Please try again." }]);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setNotices([]);
    setConfirmReject(false);
    try {
      const result = await rejectApplication(application.id, notes);
      if (!result.ok) {
        setNotices([{ tone: "error", text: result.error }]);
        return;
      }
      const next: typeof notices = [{ tone: "success", text: result.message ?? "Rejected." }];
      if (notify && result.data) {
        const email = await sendAccountNoticeAndLog(
          { kind: "application_rejected", to: result.data.email, name: result.data.name, reason: notes || null },
          { type: "application", id: application.id }
        );
        next.push({ tone: email.sent ? "success" : "warning", text: email.message });
      }
      setNotices(next);
      router.refresh();
    } catch {
      setNotices([{ tone: "error", text: "We couldn't reach the server. Please try again." }]);
    } finally {
      setBusy(null);
    }
  }

  async function saveNotes() {
    setBusy("notes");
    setNotices([]);
    try {
      const result = await updateApplicationNotes(application.id, notes);
      setNotices([{ tone: result.ok ? "success" : "error", text: result.ok ? (result.message ?? "Saved.") : result.error }]);
      if (result.ok) router.refresh();
    } catch {
      setNotices([{ tone: "error", text: "We couldn't reach the server. Please try again." }]);
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <div className="space-y-4">
      {notices.map((notice, index) => (
        <AuthAlert key={index} variant={notice.tone === "error" ? "error" : notice.tone === "warning" ? "warning" : "success"}>
          {notice.text}
        </AuthAlert>
      ))}

      <div>
        <label htmlFor="review-notes" className="mb-1.5 block text-sm font-medium">
          Review notes <span className="font-normal text-muted-foreground">(optional, visible to admins; shown to the applicant in a rejection email)</span>
        </label>
        <textarea
          id="review-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          disabled={disabled}
          className={textareaClass}
        />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-input accent-primary"
        />
        <span>Email the applicant about this decision (uses 1 EmailJS request).</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {application.status !== "approved" ? (
          <button type="button" onClick={approve} disabled={disabled} className={buttonClass("primary")}>
            {busy === "approve" ? <Spinner /> : null}
            {application.status === "rejected" ? "Approve instead" : "Approve application"}
          </button>
        ) : null}

        {application.status === "pending" ? (
          confirmReject ? (
            <span className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={reject}
                disabled={disabled}
                className={`${buttonClass("primary")} bg-destructive text-destructive-foreground hover:bg-destructive/90`}
              >
                {busy === "reject" ? <Spinner /> : null}
                Yes, reject
              </button>
              <button type="button" onClick={() => setConfirmReject(false)} className={buttonClass("outline")}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReject(true)}
              disabled={disabled}
              className={`${buttonClass("outline")} border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive`}
            >
              Reject
            </button>
          )
        ) : null}

        {reviewed ? (
          <button type="button" onClick={saveNotes} disabled={disabled} className={buttonClass("outline")}>
            {busy === "notes" ? <Spinner /> : null}
            Save notes
          </button>
        ) : null}
      </div>
    </div>
  );
}
