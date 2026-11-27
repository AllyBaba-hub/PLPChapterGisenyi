import Link from "next/link";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { PRIMARY_NAV } from "@/components/layout/nav-links";
import type { ChapterSettings } from "@/lib/public-data";
import { PARENT_SITE_URL } from "@/lib/seo";
import { socialLabel } from "@/lib/utils";

const linkClass =
  "rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SiteFooter({ settings }: { settings: ChapterSettings }) {
  const socials = Object.entries(settings.social_links);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-secondary/50">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <BrandLogo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">{settings.about_summary}</p>
        </div>

        <nav aria-label="Explore">
          <h2 className="text-sm font-semibold text-foreground sm:text-sm">Explore</h2>
          <ul className="mt-4 space-y-2">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Membership">
          <h2 className="text-sm font-semibold text-foreground sm:text-sm">Membership</h2>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/join" className={linkClass}>
                Apply to join
              </Link>
            </li>
            <li>
              <Link href="/login" className={linkClass}>
                Member sign in
              </Link>
            </li>
            <li>
              <Link href="/forgot-password" className={linkClass}>
                Forgot password
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold text-foreground sm:text-sm">Contact</h2>
          <address className="mt-4 space-y-2 text-sm not-italic text-muted-foreground">
            <p>{settings.district_location}</p>
            <p>
              <a href={`mailto:${settings.contact_email}`} className={linkClass}>
                {settings.contact_email}
              </a>
            </p>
            {settings.contact_phone ? (
              <p>
                <a href={`tel:${settings.contact_phone.replace(/[^+\d]/g, "")}`} className={linkClass}>
                  {settings.contact_phone}
                </a>
              </p>
            ) : null}
          </address>
          {socials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2" aria-label="Social media">
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer me" className={linkClass}>
                    {socialLabel(key)}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="border-t">
        <div className="container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings.chapter_name}. A chapter of {settings.parent_organization}.
          </p>
          <p>
            <a
              href={PARENT_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              plpyouth.org
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
