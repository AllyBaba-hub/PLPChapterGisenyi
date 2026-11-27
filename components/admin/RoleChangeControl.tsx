"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { changeMemberRole } from "@/app/(admin)/admin/_actions/members";
import { AuthAlert, Spinner } from "@/components/auth/ui";
import { selectClass, buttonClass } from "@/components/ui/styles";
import { ASSIGNABLE_ROLES, checkRoleChange, isAdminLevel } from "@/lib/admin-rules";
import { sendAccountNoticeAndLog } from "@/lib/admin-notify";
import { ROLE_LABELS } from "@/lib/labels";
import type { MemberStatus, UserRole } from "@/lib/rbac";

interface RoleChangeControlProps {
  member: { id: string; role: UserRole; status: MemberStatus };
  actor: { id: string; role: UserRole };
  notify: boolean;
}

export function RoleChangeControl({ member, actor, notify }: RoleChangeControlProps) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>(member.role);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const options: UserRole[] = ASSIGNABLE_ROLES.includes(member.role as (typeof ASSIGNABLE_ROLES)[number])
    ? [...ASSIGNABLE_ROLES]
    : [member.role, ...ASSIGNABLE_ROLES];

  const rule = role === member.role ? { allowed: false, reason: undefined } : checkRoleChange(actor, member, role);
  const locked =
    actor.id === member.id ||
    member.status === "pending" ||
    (!(actor.role === "super_admin") && isAdminLevel(member.role));
  const selectId = `role-${member.id}`;

  async function apply() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await changeMemberRole(member.id, role);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error });
        setRole(member.role);
        return;
      }
      let text = result.message ?? "Role changed.";
      let tone: "success" | "warning" = "success";
      if (notify && result.data) {
        const email = await sendAccountNoticeAndLog(
          { kind: "role_changed", to: result.data.email, name: result.data.name, newRoleLabel: result.data.roleLabel },
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
      <label htmlFor={selectId} className="block text-sm font-medium">
        Role
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={selectId}
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          disabled={locked || busy}
          className={`${selectClass} w-auto min-w-[12rem]`}
        >
          {options.map((value) => (
            <option key={value} value={value} disabled={!ASSIGNABLE_ROLES.includes(value as (typeof ASSIGNABLE_ROLES)[number])}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <button type="button" onClick={apply} disabled={locked || busy || !rule.allowed} className={buttonClass("primary")}>
          {busy ? <Spinner /> : null}
          Apply role
        </button>
      </div>
      {locked ? (
        <p className="text-xs text-muted-foreground">
          {actor.id === member.id
            ? "You can't change your own role."
            : member.status === "pending"
              ? "Approve this person's application first."
              : "Only a super administrator can change administrator roles."}
        </p>
      ) : role !== member.role && !rule.allowed && rule.reason ? (
        <p className="text-xs text-destructive">{rule.reason}</p>
      ) : null}
      {notice ? (
        <AuthAlert variant={notice.tone === "error" ? "error" : notice.tone === "warning" ? "warning" : "success"}>{notice.text}</AuthAlert>
      ) : null}
    </div>
  );
}
