"use client";

import { useState } from "react";
import { MemberStatusControl } from "@/components/admin/MemberStatusControl";
import { RoleChangeControl } from "@/components/admin/RoleChangeControl";
import { UserAvatar } from "@/components/member/UserAvatar";
import { Badge } from "@/components/ui/Badge";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { MemberStatus, UserRole } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export interface MemberRow {
  id: string;
  member_code: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  sector_or_cell: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: MemberStatus;
  joined_at: string | null;
}

interface MemberManageCardProps {
  member: MemberRow;
  actor: { id: string; role: UserRole };
  notifyDefault: boolean;
}

export function MemberManageCard({ member, actor, notifyDefault }: MemberManageCardProps) {
  const [notify, setNotify] = useState(notifyDefault);
  const tone = member.status === "active" ? "success" : member.status === "pending" ? "warning" : "danger";
  const isSelf = member.id === actor.id;

  return (
    <li className="rounded-xl border bg-card shadow-sm">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <UserAvatar name={member.full_name} src={member.avatar_url} size={44} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {member.full_name}
                {isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span> : null}
              </span>
              <span className="block truncate text-sm text-muted-foreground">{member.email}</span>
              <span className="block font-mono text-xs text-muted-foreground">{member.member_code ?? "No member ID yet"}</span>
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{ROLE_LABELS[member.role]}</Badge>
            <Badge tone={tone}>{STATUS_LABELS[member.status]}</Badge>
            <span className="text-sm font-semibold text-primary group-open:hidden">Manage</span>
            <span className="hidden text-sm font-semibold text-primary group-open:inline">Close</span>
          </span>
        </summary>

        <div className="space-y-5 border-t p-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</dt>
              <dd>{member.phone ?? "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sector / cell</dt>
              <dd>{member.sector_or_cell ?? "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Member since</dt>
              <dd>{member.joined_at ? formatDate(member.joined_at) : "Not recorded"}</dd>
            </div>
          </dl>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input accent-primary"
            />
            <span>Email the member about changes I make here (uses 1 EmailJS request each).</span>
          </label>

          <div className="grid gap-6 md:grid-cols-2">
            <RoleChangeControl member={member} actor={actor} notify={notify} />
            <MemberStatusControl member={member} actor={actor} notify={notify} />
          </div>
        </div>
      </details>
    </li>
  );
}
