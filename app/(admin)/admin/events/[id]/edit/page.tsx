import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityAlertButton } from "@/components/admin/ActivityAlertButton";
import { DeleteEventButton } from "@/components/admin/DeleteEventButton";
import { EventForm } from "@/components/admin/EventForm";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { PageHeading } from "@/components/member/PageHeading";
import { buttonClass } from "@/components/ui/styles";
import { getAdmin } from "@/lib/admin-data";
import { isoToKigaliLocal } from "@/lib/kigali-time";
import { formatEventWhen, isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit event" };

interface EventRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string | null;
  max_capacity: number | null;
  cover_image_url: string | null;
  is_published: boolean;
  notification_sent: boolean;
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();

  const { supabase } = await getAdmin();
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the event: ${error.message}`);
  if (!data) notFound();
  const event = data as EventRow;

  return (
    <div className="space-y-6">
      <Link href="/admin/events" className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
        ← All events
      </Link>

      <PageHeading
        title={event.title}
        description="Edit this event, manage who is coming, or email members about it."
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/admin/events/${event.id}/registrations`} className={buttonClass("outline")}>
              Registrations
            </Link>
            {event.is_published ? (
              <Link href={`/events/${event.slug}`} className={buttonClass("outline")} target="_blank" rel="noopener noreferrer">
                View public page
              </Link>
            ) : null}
            <PublishToggle kind="event" id={event.id} published={event.is_published} />
            <DeleteEventButton id={event.id} title={event.title} redirectTo="/admin/events" />
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <EventForm
            notice={query.created ? "Event created." : undefined}
            initial={{
              id: event.id,
              title: event.title,
              slug: event.slug,
              summary: event.summary,
              description: event.description,
              location: event.location,
              start_local: isoToKigaliLocal(event.start_time),
              end_local: isoToKigaliLocal(event.end_time),
              max_capacity: event.max_capacity ? String(event.max_capacity) : "",
              is_published: event.is_published,
              cover_url: event.cover_image_url,
            }}
          />
        </div>

        <aside aria-labelledby="alert-heading" className="h-fit rounded-xl border bg-card p-6 shadow-sm">
          <h2 id="alert-heading" className="mb-2 text-lg sm:text-lg">
            Email alert
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Send active members who have email alerts on a short message about this event. Recipients are batched to save free-tier email requests.
          </p>
          <ActivityAlertButton
            kind="event"
            entityId={event.id}
            subject={`New chapter event: ${event.title}`}
            title={event.title}
            message={event.summary}
            eventDate={formatEventWhen(event.start_time, event.end_time)}
            eventLocation={event.location}
            actionPath="/member/events"
            actionLabel="View and register"
            alreadyNotified={event.notification_sent}
            disabledReason={event.is_published ? undefined : "Publish the event before emailing members about it."}
          />
        </aside>
      </div>
    </div>
  );
}
