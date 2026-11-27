"use client";

import { useState } from "react";
import { getActivityAudience, logEmailNotification, markEventNotified, type ActivityAudience } from "@/app/(admin)/admin/_actions/notifications";
import { AuthAlert, Spinner } from "@/components/auth/ui";
import { buttonClass } from "@/components/ui/styles";
import {
  EMAILJS_MAX_BCC_PER_REQUEST,
  EMAILJS_MONTHLY_LIMIT,
  EmailJsError,
  getEmailQuotaStatus,
  isEmailJsConfigured,
  sendActivityEmail,
  type ActivityPriority,
} from "@/lib/emailjs";

interface ActivityAlertButtonProps {
  kind: "event" | "announcement";
  entityId: string;
  subject: string;
  title: string;
  message: string;
  priority?: ActivityPriority;
  eventDate?: string;
  eventLocation?: string;
  /** Site path members land on, e.g. /member/events. */
  actionPath: string;
  actionLabel: string;
  alreadyNotified?: boolean;
  disabledReason?: string;
}

type Phase = "idle" | "loading" | "review" | "sending";

export function ActivityAlertButton(props: ActivityAlertButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [audience, setAudience] = useState<ActivityAudience | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const configured = isEmailJsConfigured("activity");

  async function prepare() {
    setNotice(null);
    setPhase("loading");
    try {
      const result = await getActivityAudience();
      if (!result.ok || !result.data) {
        setNotice({ tone: "error", text: result.ok ? "We couldn't load the recipients." : result.error });
        setPhase("idle");
        return;
      }
      setAudience(result.data);
      setPhase("review");
    } catch {
      setNotice({ tone: "error", text: "We couldn't reach the server. Please try again." });
      setPhase("idle");
    }
  }

  async function send() {
    if (!audience) return;
    setPhase("sending");
    setNotice(null);

    try {
      const result = await sendActivityEmail(
        {
          recipients: audience.recipients,
          subject: props.subject,
          title: props.title,
          message: props.message,
          priority: props.priority,
          eventDate: props.eventDate,
          eventLocation: props.eventLocation,
          actionUrl: `${window.location.origin}${props.actionPath}`,
          actionLabel: props.actionLabel,
        },
        { knownMonthlyUsage: audience.monthlyUsage }
      );

      await logEmailNotification({
        template: "activity",
        kind: props.kind,
        entityType: props.kind,
        entityId: props.entityId,
        requests: result.requestsSent,
        recipients: result.recipientsNotified,
        failedRecipients: result.recipientsFailed.length,
        error: result.errors[0]?.code,
      });

      if (props.kind === "event" && result.recipientsNotified > 0) {
        await markEventNotified(props.entityId);
      }

      if (result.recipientsFailed.length === 0) {
        setNotice({
          tone: "success",
          text: `Alert sent to ${result.recipientsNotified} member${result.recipientsNotified === 1 ? "" : "s"} using ${result.requestsSent} EmailJS request${result.requestsSent === 1 ? "" : "s"}.`,
        });
      } else {
        setNotice({
          tone: "warning",
          text: `Sent to ${result.recipientsNotified} member${result.recipientsNotified === 1 ? "" : "s"}; ${result.recipientsFailed.length} could not be reached. ${result.errors[0]?.message ?? ""}`.trim(),
        });
      }
    } catch (error) {
      const known = error instanceof EmailJsError;
      await logEmailNotification({
        template: "activity",
        kind: props.kind,
        entityType: props.kind,
        entityId: props.entityId,
        requests: 0,
        recipients: 0,
        error: known ? error.code : "unknown",
      }).catch(() => undefined);
      setNotice({ tone: "error", text: known ? error.message : "The alert couldn't be sent. Please try again." });
    } finally {
      setPhase("idle");
      setAudience(null);
    }
  }

  const quota = audience ? getEmailQuotaStatus(audience.monthlyUsage) : null;
  const requestsNeeded = audience ? Math.ceil(audience.recipients.length / EMAILJS_MAX_BCC_PER_REQUEST) : 0;
  const overBudget = Boolean(quota && requestsNeeded > quota.activityRemaining);
  const canSend = Boolean(audience && audience.recipients.length > 0 && !overBudget && configured);

  return (
    <div className="space-y-3">
      {props.alreadyNotified ? (
        <p className="text-xs text-muted-foreground">An email alert was already sent for this event.</p>
      ) : null}

      {phase === "review" && audience ? (
        <div className="space-y-3 rounded-lg border bg-secondary/50 p-4 text-sm" role="region" aria-label="Review email alert">
          <p>
            This will email <strong>{audience.recipients.length}</strong> active member
            {audience.recipients.length === 1 ? "" : "s"} who have email alerts switched on, using{" "}
            <strong>{requestsNeeded}</strong> EmailJS request{requestsNeeded === 1 ? "" : "s"}.
          </p>
          <p className="text-muted-foreground">
            Free-tier use this month: about {quota?.used ?? 0} of {EMAILJS_MONTHLY_LIMIT} requests (
            {quota?.activityRemaining ?? 0} left for alerts).
          </p>
          {!configured ? (
            <AuthAlert variant="warning">EmailJS isn&apos;t configured. Add the NEXT_PUBLIC_EMAILJS_* variables to enable alerts.</AuthAlert>
          ) : null}
          {audience.recipients.length === 0 ? (
            <AuthAlert variant="info">No active members currently have email alerts switched on.</AuthAlert>
          ) : null}
          {overBudget ? (
            <AuthAlert variant="warning">
              Sending would exceed this month&apos;s safe email budget. Wait until next month or send fewer alerts.
            </AuthAlert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={send} disabled={!canSend} className={buttonClass("primary")}>
              Send to {audience.recipients.length} member{audience.recipients.length === 1 ? "" : "s"}
            </button>
            <button type="button" onClick={() => setPhase("idle")} className={buttonClass("outline")}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={prepare}
          disabled={phase !== "idle" || Boolean(props.disabledReason)}
          className={buttonClass("outline")}
        >
          {phase === "loading" || phase === "sending" ? <Spinner /> : null}
          {phase === "sending" ? "Sending…" : phase === "loading" ? "Checking recipients…" : "Email members about this"}
        </button>
      )}

      {props.disabledReason ? <p className="text-xs text-muted-foreground">{props.disabledReason}</p> : null}
      {notice ? <AuthAlert variant={notice.tone === "error" ? "error" : notice.tone === "warning" ? "warning" : "success"}>{notice.text}</AuthAlert> : null}
    </div>
  );
}
