import { Spinner } from "@/components/auth/ui";

export default function MemberLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <Spinner className="h-6 w-6 text-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
