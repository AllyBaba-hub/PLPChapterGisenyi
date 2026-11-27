import type { Metadata } from "next";
import Link from "next/link";
import { MessageManager, type MessageRow } from "@/components/admin/MessageManager";
import { Pagination } from "@/components/admin/Pagination";
import { inputClass } from "@/components/auth/ui";
import { PageHeading } from "@/components/member/PageHeading";
import { buttonClass, selectClass } from "@/components/ui/styles";
import { getAdmin } from "@/lib/admin-data";
import { oneOf, pageParam, pageRange, pick, searchTerm, totalPages, PAGE_SIZE, type SearchParams } from "@/lib/admin-query";

export const metadata: Metadata = { title: "Messages" };

const STATUSES = ["unread", "read", "replied", "archived"] as const;

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { supabase } = await getAdmin();

  const rawStatus = pick(params, "status");
  const status = oneOf(rawStatus, STATUSES);
  const showAll = rawStatus === "all";
  const q = searchTerm(pick(params, "q"));
  const page = pageParam(params);
  const { from, to } = pageRange(page);

  let query = supabase
    .from("contact_messages")
    .select("id, sender_name, sender_email, sender_phone, subject, message, status, admin_notes, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status) query = query.eq("status", status);
  else if (!showAll) query = query.neq("status", "archived");
  if (q) query = query.or(`sender_name.ilike.%${q}%,sender_email.ilike.%${q}%,subject.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) throw new Error(`Could not load messages: ${error.message}`);
  const messages = (data ?? []) as MessageRow[];

  return (
    <div>
      <PageHeading title="Messages" description="Messages sent through the public contact form." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3" role="search" aria-label="Filter messages">
        <div>
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium">Show</label>
          <select id="status" name="status" defaultValue={showAll ? "all" : status} className={`${selectClass} w-auto min-w-[11rem]`}>
            <option value="">Inbox (not archived)</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="archived">Archived</option>
            <option value="all">Everything</option>
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium">Search</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Sender or subject" className={inputClass} />
        </div>
        <button type="submit" className={buttonClass("primary")}>Apply filters</button>
        <Link href="/admin/messages" className={buttonClass("ghost")}>Reset</Link>
      </form>

      {messages.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No messages match these filters.</p>
      ) : (
        <MessageManager messages={messages} />
      )}

      <Pagination page={page} totalPages={totalPages(count ?? 0, PAGE_SIZE)} basePath="/admin/messages" params={{ status: rawStatus, q }} />
    </div>
  );
}
