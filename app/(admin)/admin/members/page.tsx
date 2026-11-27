import type { Metadata } from "next";
import Link from "next/link";
import { MemberManageCard, type MemberRow } from "@/components/admin/MemberManageCard";
import { Pagination } from "@/components/admin/Pagination";
import { inputClass } from "@/components/auth/ui";
import { Icon } from "@/components/member/icons";
import { PageHeading } from "@/components/member/PageHeading";
import { buttonClass, selectClass } from "@/components/ui/styles";
import { getAdmin, getAdminSettings } from "@/lib/admin-data";
import { oneOf, pageParam, pageRange, pick, searchTerm, totalPages, type SearchParams } from "@/lib/admin-query";

export const metadata: Metadata = { title: "Members" };

const ROLES = ["member", "admin", "super_admin", "applicant"] as const;
const STATUSES = ["active", "suspended", "pending"] as const;
const MEMBERS_PAGE_SIZE = 20;

export default async function MembersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase, profile } = await getAdmin();
  const settings = await getAdminSettings();

  const role = oneOf(pick(params, "role"), ROLES);
  const status = oneOf(pick(params, "status"), STATUSES);
  const q = searchTerm(pick(params, "q"));
  const page = pageParam(params);
  const { from, to } = pageRange(page, MEMBERS_PAGE_SIZE);

  let query = supabase
    .from("profiles")
    .select("id, member_code, full_name, email, phone, sector_or_cell, avatar_url, role, status, joined_at", { count: "exact" })
    .order("full_name", { ascending: true })
    .range(from, to);

  query = role ? query.eq("role", role) : query.in("role", ["member", "admin", "super_admin"]);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,member_code.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) throw new Error(`Could not load members: ${error.message}`);
  const members = (data ?? []) as MemberRow[];
  const pages = totalPages(count ?? 0, MEMBERS_PAGE_SIZE);

  const exportParams = new URLSearchParams();
  if (role) exportParams.set("role", role);
  if (status) exportParams.set("status", status);
  if (q) exportParams.set("q", q);
  const exportHref = `/api/members/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div>
      <PageHeading
        title="Members"
        description="Manage roles and account status. Only super administrators can change administrator roles."
        actions={
          <a href={exportHref} className={buttonClass("outline")}>
            <Icon name="download" className="h-4 w-4" />
            Export CSV
          </a>
        }
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3" role="search" aria-label="Filter members">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium">Search</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, email or member ID" className={inputClass} />
        </div>
        <div>
          <label htmlFor="role" className="mb-1.5 block text-sm font-medium">Role</label>
          <select id="role" name="role" defaultValue={role} className={`${selectClass} w-auto min-w-[11rem]`}>
            <option value="">Chapter members</option>
            <option value="member">Members</option>
            <option value="admin">Administrators</option>
            <option value="super_admin">Super administrators</option>
            <option value="applicant">Applicants</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium">Status</label>
          <select id="status" name="status" defaultValue={status} className={`${selectClass} w-auto min-w-[9rem]`}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <button type="submit" className={buttonClass("primary")}>Apply filters</button>
        <Link href="/admin/members" className={buttonClass("ghost")}>Reset</Link>
      </form>

      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {count ?? 0} result{count === 1 ? "" : "s"}
      </p>

      {members.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No members match these filters.</p>
      ) : (
        <ul className="space-y-3">
          {members.map((member) => (
            <MemberManageCard
              key={member.id}
              member={member}
              actor={{ id: profile.id, role: profile.role }}
              notifyDefault={settings.auto_email_notifications}
            />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={pages} basePath="/admin/members" params={{ q, role, status }} />
    </div>
  );
}
