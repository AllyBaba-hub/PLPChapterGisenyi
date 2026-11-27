"use client";

import { useRouter } from "next/navigation";
import { deleteEvent } from "@/app/(admin)/admin/_actions/events";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export function DeleteEventButton({ id, title, redirectTo }: { id: string; title: string; redirectTo?: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete"
      ariaLabel={`Delete event "${title}"`}
      confirmLabel="Yes, delete event"
      onConfirm={() => deleteEvent(id)}
      onDone={redirectTo ? () => router.push(redirectTo) : undefined}
    />
  );
}
