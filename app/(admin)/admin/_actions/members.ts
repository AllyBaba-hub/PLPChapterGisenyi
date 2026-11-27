"use server";

import {
  ASSIGNABLE_ROLES,
  checkRoleChange,
  checkStatusChange,
  MANAGEABLE_STATUSES,
  type ManageableStatus,
} from "@/lib/admin-rules";
import { adminAudit, dbMessage, fail, getAdminContext, revalidateAdmin, type ActionResult } from "@/lib/admin-actions";
import { ROLE_LABELS } from "@/lib/labels";
import { isUserRole, type MemberStatus, type UserRole } from "@/lib/rbac";
import { isUuid } from "@/lib/utils";

export interface MemberNotice {
  email: string;
  name: string;
  roleLabel: string;
}

interface TargetRow {
  id: string;
  role: UserRole;
  status: MemberStatus;
  email: string;
  full_name: string;
}

async function loadTarget(
  supabase: Parameters<typeof adminAudit>[0]["supabase"],
  userId: string
): Promise<TargetRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, status, email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) console.error("[admin/members] load:", error.message);
  return (data as TargetRow | null) ?? null;
}

async function otherActiveSuperAdmins(
  supabase: Parameters<typeof adminAudit>[0]["supabase"],
  excludeId: string
): Promise<number> {
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("status", "active")
    .neq("id", excludeId);
  return count ?? 0;
}

export async function changeMemberRole(userId: string, newRole: string): Promise<ActionResult<MemberNotice>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  if (!isUuid(userId) || !isUserRole(newRole) || !(ASSIGNABLE_ROLES as readonly string[]).includes(newRole)) {
    return fail("Invalid request.");
  }

  const target = await loadTarget(ctx.supabase, userId);
  if (!target) return fail("We couldn't find that member.");

  const rule = checkRoleChange({ id: ctx.profile.id, role: ctx.profile.role }, target, newRole);
  if (!rule.allowed) return fail(rule.reason ?? "You can't make that change.");

  if (target.role === "super_admin" && (await otherActiveSuperAdmins(ctx.supabase, target.id)) === 0) {
    return fail("At least one active super administrator is required.");
  }

  const { error } = await ctx.supabase.from("profiles").update({ role: newRole }).eq("id", userId);
  if (error) {
    console.error("[admin/members] role:", error.message);
    return fail(dbMessage(error, "We couldn't change that role. Please try again."));
  }

  await adminAudit(ctx, "ROLE_CHANGED", "member", userId, {
    member_email: target.email,
    from: target.role,
    to: newRole,
  });
  revalidateAdmin("/admin/members");

  return {
    ok: true,
    message: `Role changed to ${ROLE_LABELS[newRole]}.`,
    data: { email: target.email, name: target.full_name, roleLabel: ROLE_LABELS[newRole] },
  };
}

export async function setMemberStatus(userId: string, newStatus: string): Promise<ActionResult<MemberNotice>> {
  const auth = await getAdminContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;

  if (!isUuid(userId) || !(MANAGEABLE_STATUSES as readonly string[]).includes(newStatus)) {
    return fail("Invalid request.");
  }
  const status = newStatus as ManageableStatus;

  const target = await loadTarget(ctx.supabase, userId);
  if (!target) return fail("We couldn't find that member.");

  const rule = checkStatusChange({ id: ctx.profile.id, role: ctx.profile.role }, target, status);
  if (!rule.allowed) return fail(rule.reason ?? "You can't make that change.");

  if (
    status === "suspended" &&
    target.role === "super_admin" &&
    (await otherActiveSuperAdmins(ctx.supabase, target.id)) === 0
  ) {
    return fail("At least one active super administrator is required.");
  }

  const { error } = await ctx.supabase.from("profiles").update({ status }).eq("id", userId);
  if (error) {
    console.error("[admin/members] status:", error.message);
    return fail(dbMessage(error, "We couldn't change that status. Please try again."));
  }

  await adminAudit(ctx, "MEMBER_STATUS_CHANGED", "member", userId, {
    member_email: target.email,
    from: target.status,
    to: status,
  });
  revalidateAdmin("/admin/members");

  return {
    ok: true,
    message: status === "suspended" ? "Member suspended. They can no longer sign in." : "Member reactivated.",
    data: { email: target.email, name: target.full_name, roleLabel: ROLE_LABELS[target.role] },
  };
}
