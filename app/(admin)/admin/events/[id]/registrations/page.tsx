import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceManager, type RegistrantRow } from "@/components/admin/AttendanceManager";
import { PageHeading } from "@/components/member/PageHeading";
import { getAdmin } from "@/lib/admin-data";
import { formatEventWhen, isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Event registrations" };

interface RawRegistrant {
  id: string;
  attended: boolean;
  registered_at: string;
  member: RegistrantRow["member"] | NonNullable<RegistrantRow["member"]>[] | null;
}

export default async function EventRegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { supabase } = await getAdmin();
  const [event, registrations] = await Promise.all([
    supabase.from("events").select("id, title, location, start_time, end_time, max_capacity").eq("id", id).maybeSingle(),
    supabase
      .from("event_registrations")
      .select("id, attended, registered_at, member:profiles(full_name, email, member_code)")
      .eq("event_id", id)
      .order("registered_at", { ascending: true })
      .limit(1000),
  ]);

  if (event.error) throw new Error(`Could not load the event: ${event.error.message}`);
  if (!event.data) notFound();
  if (registrations.error) throw new Error(`Could not load registrations: ${registrations.error.message}`);

  const info = event.data as { id: string; title: string; location: string; start_time: string; end_time: string | null; max_capacity: number | null };
  const registrants: RegistrantRow[] = ((registrations.data ?? []) as unknown as RawRegistrant[]).map((row) => ({
    id: row.id,
    attended: row.attended,
    registered_at: row.registered_at,
    member: Array.isArray(row.member) ? (row.member[0] ?? null) : row.member,
  }));

  return (
    <div className="space-y-6">
      <Link href={`/admin/events/${info.id}/edit`} className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
        ← Back to event
      </Link>
      <PageHeading
        title={`Registrations: ${info.title}`}
        description={`${formatEventWhen(info.start_time, info.end_time)} · ${info.location} · ${registrants.length}${info.max_capacity ? ` of ${info.max_capacity}` : ""} registered`}
      />
      <AttendanceManager eventId={info.id} registrants={registrants} />
    </div>
  );
}
