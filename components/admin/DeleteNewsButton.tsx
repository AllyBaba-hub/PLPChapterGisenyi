"use client";

import { useRouter } from "next/navigation";
import { deleteNews } from "@/app/(admin)/admin/_actions/news";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export function DeleteNewsButton({ id, title, redirectTo }: { id: string; title: string; redirectTo?: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete"
      ariaLabel={`Delete article "${title}"`}
      confirmLabel="Yes, delete article"
      onConfirm={() => deleteNews(id)}
      onDone={redirectTo ? () => router.push(redirectTo) : undefined}
    />
  );
}
