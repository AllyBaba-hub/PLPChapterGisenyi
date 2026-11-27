import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { buttonClass } from "@/components/ui/styles";
import { getChapterSettings } from "@/lib/public-data";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const settings = await getChapterSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main id="main-content" className="container flex flex-1 flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2">We couldn&apos;t find that page</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          The page may have moved, or the event or article may no longer be published.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClass("primary", "lg")}>
            Go to the home page
          </Link>
          <Link href="/events" className={buttonClass("outline", "lg")}>
            See events
          </Link>
        </div>
      </main>
      <SiteFooter settings={settings} />
    </div>
  );
}
