import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/admin/Pagination";
import { PageHeading } from "@/components/member/PageHeading";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass, selectClass } from "@/components/ui/styles";
import { inputClass } from "@/components/auth/ui";
import { getAdmin } from "@/lib/admin-data";
import { oneOf, pageParam, pageRange, pick, searchTerm, totalPages, PAGE_SIZE, type SearchParams } from "@/lib/admin-query";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Applications" };

const STATUSES = ["pending", "approved", "rejected"] as const;
const TONES: Record<string, BadgeTone> = { pending: "warning", approved: "success", rejected: "danger" };

interface Row {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  sector_or_cell: string;
  status: string;
  created_at: string;
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase } = await getAdmin();

  const rawStatus = pick(params, "status");
  const status = rawStatus === "all" ? "" : (oneOf(rawStatus, STATUSES) || "pending");
  const q = searchTerm(pick(params, "q"));
  const page = pageParam(params);
  const { from, to } = pageRange(page);

  let query = supabase
    .from("membership_applications")
    .select("id, full_name, email, phone, sector_or_cell, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,sector_or_cell.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) throw new Error(`Could not load applications: ${error.message}`);
  const rows = (data ?? []) as Row[];
  const pages = totalPages(count ?? 0, PAGE_SIZE);

  return (
    <div>
      <PageHeading title="Membership applications" description="Review people who have applied to join the chapter." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3" role="search" aria-label="Filter applications">
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium">Status</label>
          <select id="status" name="status" defaultValue={rawStatus === "all" ? "all" : status || "pending"} className={`${selectClass} w-auto min-w-[10rem]`}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium">Search</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, email or sector" className={inputClass} />
        </div>
        <button type="submit" className={buttonClass("primary")}>Apply filters</button>
        <Link href="/admin/applications" className={buttonClass("ghost")}>Reset</Link>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No applications match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Membership applications</caption>
            <thead className="border-b bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Applicant</th>
                <th scope="col" className="px-4 py-3 font-semibold">Sector / cell</th>
                <th scope="col" className="px-4 py-3 font-semibold">Applied</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.full_name}</p>
                    <p className="text-xs text-muted-foreground">{row.email} · {row.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.sector_or_cell}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3"><Badge tone={TONES[row.status] ?? "muted"}>{row.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/applications/${row.id}`} className="font-semibold text-primary underline-offset-4 hover:underline" aria-label={`Review application from ${row.full_name}`}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={pages} basePath="/admin/applications" params={{ status: rawStatus, q }} />
    </div>
  );
}
