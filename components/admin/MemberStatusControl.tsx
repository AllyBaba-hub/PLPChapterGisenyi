"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setMemberStatus } from "@/app/(admin)/admin/_actions/members";
import { AuthAlert, Spinner } from "@/components/auth/ui";
import { buttonClass } from "@/components/ui/styles";
import { sendAccountNoticeAndLog } from "@/lib/admin-notify";
import { checkStatusChange } from "@/lib/admin-rules";
import type { MemberStatus, UserRole } from "@/lib/rbac";

interface MemberStatusControlProps {
  member: { id: string; role: UserRole; status: MemberStatus };
  actor: { id: string; role: UserRole };
  notify: boolean;
}

export function MemberStatusControl({ member, actor, notify }: MemberStatusControlProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const target = member.status === "suspended" ? "active" : "suspended";
  const rule = member.status === "pending" ? { allowed: false, reason: "Approve this person's application to activate their account." } : checkStatusChange(actor, member, target);

  async function apply() {
    setBusy(true);
    setConfirming(false);
    setNotice(null);
    try {
      const result = await setMemberStatus(member.id, target);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      let text = result.message ?? "Status updated.";
      let tone: "success" | "warning" = "success";
      if (notify && result.data) {
        const email = await sendAccountNoticeAndLog(
          { kind: target === "suspended" ? "account_suspended" : "account_reactivated", to: result.data.email, name: result.data.name },
          { type: "member", id: member.id }
        );
        text += ` ${email.message}`;
        if (!email.sent) tone = "warning";
      }
      setNotice({ tone, text });
      router.refresh();
    } catch {
      setNotice({ tone: "error", text: "We couldn't reach the server. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Account status</p>
      {rule.allowed ? (
        target === "suspended" && !confirming ? (
          <button type="button" onClick={() => setConfirming(true)} disabled={busy} className={`${buttonClass("outline")} border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive`}>
            Suspend account
          </button>
        ) : target === "suspended" ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="text-sm">Suspended members can&apos;t sign in. Continue?</span>
            <button type="button" onClick={apply} disabled={busy} className={`${buttonClass("primary")} bg-destructive text-destructive-foreground hover:bg-destructive/90`}>
              {busy ? <Spinner /> : null}
              Yes, suspend
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={buttonClass("outline")}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" onClick={apply} disabled={busy} className={buttonClass("primary")}>
            {busy ? <Spinner /> : null}
            Reactivate account
          </button>
        )
      ) : (
        <p className="text-xs text-muted-foreground">{rule.reason}</p>
      )}
      {notice ? (
        <AuthAlert variant={notice.tone === "error" ? "error" : notice.tone === "warning" ? "warning" : "success"}>{notice.text}</AuthAlert>
      ) : null}
    </div>
  );
}
