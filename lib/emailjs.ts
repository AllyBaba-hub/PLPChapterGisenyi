import { isValidEmail, normalizeEmail } from "@/lib/auth-validation";

/* ============================================================================
   EmailJS helper — free tier: 200 requests/month, 2 templates, 1 request/sec.

   Template 1 ("activity")  → NEXT_PUBLIC_EMAILJS_ACTIVITY_TEMPLATE_ID
     Variables: {{to_email}} (To field), {{bcc}} (Bcc field), {{subject}}, {{title}},
                {{message}}, {{priority_label}}, {{event_date}}, {{event_location}},
                {{action_url}}, {{action_label}}, {{chapter_name}}, {{reply_to}}
   Template 2 ("account")   → NEXT_PUBLIC_EMAILJS_ACCOUNT_TEMPLATE_ID
     Variables: {{to_email}}, {{to_name}}, {{subject}}, {{heading}}, {{message}},
                {{details}}, {{member_code}}, {{action_url}}, {{action_label}},
                {{chapter_name}}, {{reply_to}}

   Quota safety:
     • All requests run through one serialized queue spaced ≥ 1.1 s apart.
     • Activity alerts are BCC-batched (one request per chunk of recipients).
     • A batch is checked against the remaining monthly budget BEFORE sending.
     • A per-browser monthly counter (localStorage) is kept as a best effort;
       pass `knownMonthlyUsage` (e.g. derived from audit logs) for a shared count.
       The EmailJS dashboard remains the source of truth.
   ============================================================================ */

export type EmailTemplateKey = "activity" | "account";

export type EmailJsErrorCode =
  | "config"
  | "quota"
  | "invalid"
  | "rate_limited"
  | "network"
  | "rejected";

export class EmailJsError extends Error {
  readonly code: EmailJsErrorCode;
  readonly status?: number;

  constructor(code: EmailJsErrorCode, message: string, status?: number) {
    super(message);
    this.name = "EmailJsError";
    this.code = code;
    this.status = status;
  }
}

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

export const EMAILJS_MONTHLY_LIMIT = 200;
export const EMAILJS_MIN_INTERVAL_MS = 1100;
/** Conservative cap on BCC recipients per request; lower it if your plan requires. */
export const EMAILJS_MAX_BCC_PER_REQUEST = 50;

/** Leaves headroom so account notices can still go out after activity alerts. */
const QUOTA_CEILING: Record<EmailTemplateKey, number> = {
  activity: 180,
  account: 195,
};

const DEFAULT_CHAPTER_NAME = "PLP Chapter Gisenyi";
const DEFAULT_CHAPTER_EMAIL = "gisenyi@plpyouth.org";

/* ------------------------------------------------------------------ config */

interface EmailJsConfig {
  serviceId: string;
  publicKey: string;
  templateId: string;
}

function readConfig(template: EmailTemplateKey): EmailJsConfig {
  // NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const templateId =
    template === "activity"
      ? process.env.NEXT_PUBLIC_EMAILJS_ACTIVITY_TEMPLATE_ID
      : process.env.NEXT_PUBLIC_EMAILJS_ACCOUNT_TEMPLATE_ID;

  if (!serviceId || !publicKey || !templateId) {
    throw new EmailJsError(
      "config",
      "EmailJS is not configured. Set the NEXT_PUBLIC_EMAILJS_* environment variables."
    );
  }
  return { serviceId, publicKey, templateId };
}

export function isEmailJsConfigured(template?: EmailTemplateKey): boolean {
  const base = Boolean(
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID && process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
  );
  if (!base) return false;
  if (template === "activity") return Boolean(process.env.NEXT_PUBLIC_EMAILJS_ACTIVITY_TEMPLATE_ID);
  if (template === "account") return Boolean(process.env.NEXT_PUBLIC_EMAILJS_ACCOUNT_TEMPLATE_ID);
  return Boolean(
    process.env.NEXT_PUBLIC_EMAILJS_ACTIVITY_TEMPLATE_ID &&
      process.env.NEXT_PUBLIC_EMAILJS_ACCOUNT_TEMPLATE_ID
  );
}

/* ------------------------------------------------------------ usage counter */

function usageKey(date: Date = new Date()): string {
  return `plp:emailjs:usage:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function readLocalUsage(): number {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(usageKey()));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function incrementLocalUsage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(usageKey(), String(readLocalUsage() + 1));
  } catch {
    // Storage may be unavailable; quota checks then rely on knownMonthlyUsage.
  }
}

export interface EmailQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  activityRemaining: number;
  accountRemaining: number;
}

export function getEmailQuotaStatus(knownMonthlyUsage?: number): EmailQuotaStatus {
  const used = Math.max(readLocalUsage(), knownMonthlyUsage ?? 0);
  return {
    used,
    limit: EMAILJS_MONTHLY_LIMIT,
    remaining: Math.max(0, EMAILJS_MONTHLY_LIMIT - used),
    activityRemaining: Math.max(0, QUOTA_CEILING.activity - used),
    accountRemaining: Math.max(0, QUOTA_CEILING.account - used),
  };
}

function assertQuota(
  template: EmailTemplateKey,
  needed: number,
  knownMonthlyUsage?: number
): void {
  const used = Math.max(readLocalUsage(), knownMonthlyUsage ?? 0);
  const available = Math.max(0, QUOTA_CEILING[template] - used);
  if (needed > available) {
    throw new EmailJsError(
      "quota",
      `This send needs ${needed} EmailJS request${needed === 1 ? "" : "s"} but only ${available} remain in this month's safe budget (${used} of ${EMAILJS_MONTHLY_LIMIT} used).`
    );
  }
}

/* -------------------------------------------------- serialized, spaced queue */

let queueTail: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = lastRequestAt + EMAILJS_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  queueTail = run.catch(() => undefined);
  return run;
}

/* -------------------------------------------------------------- transport */

async function postToEmailJs(
  config: EmailJsConfig,
  templateParams: Record<string, string>
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(EMAILJS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: templateParams,
      }),
    });
  } catch {
    throw new EmailJsError("network", "Could not reach EmailJS. Check the connection and try again.");
  }

  if (response.ok) return;

  if (response.status === 429) {
    throw new EmailJsError("rate_limited", "EmailJS rate limit reached.", 429);
  }
  throw new EmailJsError(
    "rejected",
    `EmailJS rejected the request (HTTP ${response.status}). Check the service, template and key settings.`,
    response.status
  );
}

export interface SendOptions {
  /** Month-to-date request count known by the caller (e.g. from audit logs). */
  knownMonthlyUsage?: number;
}

async function sendTemplate(
  template: EmailTemplateKey,
  params: Record<string, string>,
  options: SendOptions
): Promise<void> {
  const config = readConfig(template);

  await enqueue(async () => {
    assertQuota(template, 1, options.knownMonthlyUsage);
    try {
      await postToEmailJs(config, params);
    } catch (error) {
      if (error instanceof EmailJsError && error.code === "rate_limited") {
        await sleep(1500);
        await postToEmailJs(config, params);
      } else {
        throw error;
      }
    }
    incrementLocalUsage();
  });
}

/* ---------------------------------------------------------------- helpers */

function cleanLine(value: string | undefined, max: number): string {
  return (value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

function cleanText(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

function cleanRecipients(recipients: string[]): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const raw of recipients) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    (isValidEmail(email) ? valid : invalid).push(email);
  }
  return { valid, invalid };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function resolveSiteUrl(explicit?: string): string {
  if (explicit) return explicit.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Formats a date for emails in Rwanda time, e.g. "Saturday 5 December 2026 at 09:00". */
export function formatEmailDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Kigali",
  }).format(date);
}

/* ------------------------------------------- Template 1: activity / alerts */

export type ActivityPriority = "normal" | "important" | "urgent";

export interface ActivityEmailInput {
  /** Member emails; callers must already exclude members who opted out. */
  recipients: string[];
  subject: string;
  title: string;
  message: string;
  priority?: ActivityPriority;
  eventDate?: string;
  eventLocation?: string;
  actionUrl?: string;
  actionLabel?: string;
  chapterName?: string;
  /** Visible "To" address and reply-to; recipients are placed in BCC. */
  chapterEmail?: string;
}

export interface BatchSendResult {
  requestsSent: number;
  recipientsNotified: number;
  recipientsFailed: string[];
  skippedInvalid: string[];
  errors: EmailJsError[];
}

const PRIORITY_LABELS: Record<ActivityPriority, string> = {
  normal: "",
  important: "Important",
  urgent: "Urgent",
};

export interface ActivitySendOptions extends SendOptions {
  /** Defaults to (and cannot exceed) EMAILJS_MAX_BCC_PER_REQUEST. */
  maxRecipientsPerRequest?: number;
}

export async function sendActivityEmail(
  input: ActivityEmailInput,
  options: ActivitySendOptions = {}
): Promise<BatchSendResult> {
  const subject = cleanLine(input.subject, 150);
  const title = cleanLine(input.title, 150);
  const message = cleanText(input.message, 4000);

  if (!subject || !title || !message) {
    throw new EmailJsError("invalid", "An activity email needs a subject, title and message.");
  }

  const { valid, invalid } = cleanRecipients(input.recipients);
  if (valid.length === 0) {
    throw new EmailJsError("invalid", "No valid recipient email addresses were provided.");
  }

  readConfig("activity");

  const chunkSize = Math.min(
    Math.max(1, Math.floor(options.maxRecipientsPerRequest ?? EMAILJS_MAX_BCC_PER_REQUEST)),
    EMAILJS_MAX_BCC_PER_REQUEST
  );
  const chunks = chunk(valid, chunkSize);

  // All-or-nothing budget check so a broadcast is never half-sent for quota reasons.
  assertQuota("activity", chunks.length, options.knownMonthlyUsage);

  const chapterEmail = cleanLine(input.chapterEmail, 254) || DEFAULT_CHAPTER_EMAIL;
  const baseParams: Record<string, string> = {
    to_email: chapterEmail,
    reply_to: chapterEmail,
    subject,
    title,
    message,
    priority_label: PRIORITY_LABELS[input.priority ?? "normal"],
    event_date: cleanLine(input.eventDate, 200),
    event_location: cleanLine(input.eventLocation, 200),
    action_url: cleanLine(input.actionUrl, 500),
    action_label: cleanLine(input.actionLabel, 80) || (input.actionUrl ? "View details" : ""),
    chapter_name: cleanLine(input.chapterName, 100) || DEFAULT_CHAPTER_NAME,
  };

  const result: BatchSendResult = {
    requestsSent: 0,
    recipientsNotified: 0,
    recipientsFailed: [],
    skippedInvalid: invalid,
    errors: [],
  };

  for (let index = 0; index < chunks.length; index += 1) {
    const group = chunks[index];
    try {
      await sendTemplate("activity", { ...baseParams, bcc: group.join(",") }, options);
      result.requestsSent += 1;
      result.recipientsNotified += group.length;
    } catch (error) {
      const failure =
        error instanceof EmailJsError
          ? error
          : new EmailJsError("network", "Unexpected error while sending email.");
      result.errors.push(failure);
      result.recipientsFailed.push(...group);

      if (failure.code === "config" || failure.code === "quota") {
        for (const remaining of chunks.slice(index + 1)) result.recipientsFailed.push(...remaining);
        break;
      }
    }
  }

  return result;
}

/* ------------------------------------- Template 2: account / status notices */

export type AccountNoticeKind =
  | "application_approved"
  | "application_rejected"
  | "account_suspended"
  | "account_reactivated"
  | "role_changed";

export interface AccountNoticeInput {
  kind: AccountNoticeKind;
  to: string;
  name: string;
  memberCode?: string | null;
  /** Reviewer note or reason, shown only when provided. */
  reason?: string | null;
  /** Human-readable role for "role_changed", e.g. "Administrator". */
  newRoleLabel?: string;
  actionUrl?: string;
  siteUrl?: string;
  chapterName?: string;
  chapterEmail?: string;
}

export const ROLE_LABELS: Record<string, string> = {
  visitor: "Visitor",
  applicant: "Applicant",
  member: "Member",
  admin: "Administrator",
  super_admin: "Super administrator",
};

interface NoticeCopy {
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  actionPath: string;
}

function buildNoticeCopy(input: AccountNoticeInput, chapterName: string, name: string): NoticeCopy {
  switch (input.kind) {
    case "application_approved":
      return {
        subject: `Welcome to ${chapterName} — your membership is approved`,
        heading: "Your membership is approved",
        message: `Congratulations, ${name}! Your application to join ${chapterName} has been approved. Sign in to the member portal to see your digital membership card, upcoming events and chapter announcements.`,
        actionLabel: "Sign in to the member portal",
        actionPath: "/login",
      };
    case "application_rejected":
      return {
        subject: `Update on your ${chapterName} membership application`,
        heading: "Your application was not approved",
        message: `Hello ${name}, thank you for your interest in ${chapterName}. After review, we are unable to approve your membership application at this time. You are welcome to contact the chapter with any questions.`,
        actionLabel: "Contact the chapter",
        actionPath: "/contact",
      };
    case "account_suspended":
      return {
        subject: `Your ${chapterName} account has been suspended`,
        heading: "Your account is suspended",
        message: `Hello ${name}, your ${chapterName} member account has been suspended and you can no longer sign in to the member portal. Please contact chapter leadership if you believe this is a mistake.`,
        actionLabel: "Contact the chapter",
        actionPath: "/contact",
      };
    case "account_reactivated":
      return {
        subject: `Your ${chapterName} account is active again`,
        heading: "Your account is active again",
        message: `Hello ${name}, your ${chapterName} member account has been reactivated. You can sign in to the member portal again.`,
        actionLabel: "Sign in to the member portal",
        actionPath: "/login",
      };
    case "role_changed":
      return {
        subject: `Your ${chapterName} role has changed`,
        heading: "Your role was updated",
        message: `Hello ${name}, your role in ${chapterName} has been updated${
          input.newRoleLabel ? ` to ${input.newRoleLabel}` : ""
        }. Sign in to see what you can now access.`,
        actionLabel: "Sign in to the member portal",
        actionPath: "/login",
      };
  }
}

export async function sendAccountNotice(
  input: AccountNoticeInput,
  options: SendOptions = {}
): Promise<void> {
  const to = normalizeEmail(input.to);
  if (!isValidEmail(to)) {
    throw new EmailJsError("invalid", "The recipient email address is not valid.");
  }

  const name = cleanLine(input.name, 100) || "member";
  const chapterName = cleanLine(input.chapterName, 100) || DEFAULT_CHAPTER_NAME;
  const chapterEmail = cleanLine(input.chapterEmail, 254) || DEFAULT_CHAPTER_EMAIL;
  const copy = buildNoticeCopy(input, chapterName, name);

  const siteUrl = resolveSiteUrl(input.siteUrl);
  const explicitUrl = cleanLine(input.actionUrl, 500);
  const actionUrl = explicitUrl || (siteUrl ? `${siteUrl}${copy.actionPath}` : "");

  await sendTemplate(
    "account",
    {
      to_email: to,
      to_name: name,
      reply_to: chapterEmail,
      subject: copy.subject,
      heading: copy.heading,
      message: copy.message,
      details: cleanText(input.reason ?? undefined, 1000),
      member_code: cleanLine(input.memberCode ?? undefined, 40),
      action_url: actionUrl,
      action_label: actionUrl ? copy.actionLabel : "",
      chapter_name: chapterName,
    },
    options
  );
}
