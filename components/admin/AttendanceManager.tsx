"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { markAllAttended, removeRegistration, setAttendance } from "@/app/(admin)/admin/_actions/events";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AuthAlert } from "@/components/auth/ui";
import { buttonClass } from "@/components/ui/styles";
import { formatDate } from "@/lib/utils";

export interface RegistrantRow {
  id: string;
  attended: boolean;
  registered_at: string;
  member: { full_name: string; email: string; member_code: string | null } | null;
}

export function AttendanceManager({ eventId, registrants }: { eventId: string; registrants: RegistrantRow[] }) {
  const router = useRouter();
  const [attended, setAttended] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(registrants.map((row) => [row.id, row.attended]))
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const attendedCount = Object.values(attended).filter(Boolean).length;

  async function toggle(id: string) {
    const next = !attended[id];
    setAttended((current) => ({ ...current, [id]: next }));
    setBusyId(id);
    setNotice(null);
    const result = await setAttendance(id, next).catch(() => ({ ok: false as const, error: "We couldn't reach the server." }));
    setBusyId(null);
    if (!result.ok) {
      setAttended((current) => ({ ...current, [id]: !next }));
      setNotice({ tone: "error", text: result.error });
    }
  }

  async function markAll() {
    setBulkBusy(true);
    setNotice(null);
    const result = await markAllAttended(eventId).catch(() => ({ ok: false as const, error: "We couldn't reach the server." }));
    setBulkBusy(false);
    if (result.ok) {
      setAttended(Object.fromEntries(registrants.map((row) => [row.id, true])));
      setNotice({ tone: "success", text: result.message ?? "Attendance updated." });
      router.refresh();
    } else {
      setNotice({ tone: "error", text: result.error });
    }
  }

  if (registrants.length === 0) {
    return <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nobody has registered for this event yet.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {attendedCount} of {registrants.length} marked as attended
        </p>
        <button type="button" onClick={markAll} disabled={bulkBusy || attendedCount === registrants.length} className={buttonClass("outline")}>
          Mark everyone as attended
        </button>
      </div>

      {notice ? (
        <div className="mb-4">
          <AuthAlert variant={notice.tone === "error" ? "error" : "success"}>{notice.text}</AuthAlert>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Registered members and attendance</caption>
          <thead className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Member</th>
              <th scope="col" className="px-4 py-3 font-semibold">Registered</th>
              <th scope="col" className="px-4 py-3 font-semibold">Attended</th>
              <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {registrants.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.member?.full_name ?? "Former member"}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.member?.email ?? ""}
                    {row.member?.member_code ? ` · ${row.member.member_code}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(row.registered_at)}</td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(attended[row.id])}
                      onChange={() => toggle(row.id)}
                      disabled={busyId === row.id}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span className="sr-only">Attended: {row.member?.full_name ?? "member"}</span>
                    <span aria-hidden="true">{attended[row.id] ? "Yes" : "No"}</span>
                  </label>
                </td>
                <td className="px-4 py-3 text-right">
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Yes, remove"
                    ariaLabel={`Remove registration for ${row.member?.full_name ?? "member"}`}
                    onConfirm={() => removeRegistration(row.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
