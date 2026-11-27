import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/admin/EventForm";
import { PageHeading } from "@/components/member/PageHeading";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <Link href="/admin/events" className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline">
        ← All events
      </Link>
      <PageHeading title="New event" description="Fill in the details. You can publish now or save it as a draft." />
      <div className="max-w-3xl rounded-xl border bg-card p-6 shadow-sm">
        <EventForm
          initial={{
            title: "",
            slug: "",
            summary: "",
            description: "",
            location: "",
            start_local: "",
            end_local: "",
            max_capacity: "",
            is_published: false,
            cover_url: null,
          }}
        />
      </div>
    </div>
  );
}
