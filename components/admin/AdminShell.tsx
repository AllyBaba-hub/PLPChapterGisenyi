"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { Icon, type IconName } from "@/components/member/icons";
import { SignOutButton } from "@/components/member/SignOutButton";
import { UserAvatar } from "@/components/member/UserAvatar";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  badge?: "applications" | "messages";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "home", exact: true },
  { href: "/admin/applications", label: "Applications", icon: "clipboard", badge: "applications" },
  { href: "/admin/members", label: "Members", icon: "users" },
  { href: "/admin/events", label: "Events", icon: "calendar" },
  { href: "/admin/news", label: "News", icon: "newspaper" },
  { href: "/admin/gallery", label: "Gallery", icon: "image" },
  { href: "/admin/announcements", label: "Announcements", icon: "bell" },
  { href: "/admin/messages", label: "Messages", icon: "mail", badge: "messages" },
  { href: "/admin/reports", label: "Reports", icon: "chart" },
  { href: "/admin/settings", label: "Settings", icon: "sliders" },
  { href: "/admin/audit-logs", label: "Audit logs", icon: "shield" },
];

export interface AdminShellProfile {
  full_name: string;
  avatar_url: string | null;
  role_label: string;
}

interface AdminShellProps {
  profile: AdminShellProfile;
  counts: { applications: number; messages: number };
  children: ReactNode;
}

function NavList({
  pathname,
  counts,
  onNavigate,
}: {
  pathname: string;
  counts: AdminShellProps["counts"];
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badge = item.badge ? counts[item.badge] : 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-sidebar-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {badge > 0 ? (
                <span
                  className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground"
                  aria-label={`${badge} waiting`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function QuickLinks() {
  const linkClass =
    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="space-y-1">
      <Link href="/member" className={linkClass}>
        <Icon name="user" className="h-4 w-4" />
        Member portal
      </Link>
      <Link href="/" className={linkClass}>
        <Icon name="globe" className="h-4 w-4" />
        View public site
      </Link>
    </div>
  );
}

function AdminBadge({ profile, compact = false }: { profile: AdminShellProfile; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar name={profile.full_name} src={profile.avatar_url} size={compact ? 36 : 44} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-foreground">{profile.full_name}</p>
        <p className="truncate text-xs text-muted-foreground">{profile.role_label}</p>
      </div>
    </div>
  );
}

export function AdminShell({ profile, counts, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const trigger = triggerRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-secondary/40 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] print:block print:bg-background">
      <a
        href="#admin-main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <aside
        aria-label="Admin navigation"
        className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar lg:flex print:hidden"
      >
        <div className="border-b px-5 py-4">
          <Link href="/admin" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandLogo />
          </Link>
          <p className="mt-2 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
            Administration
          </p>
        </div>
        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
          <NavList pathname={pathname} counts={counts} />
        </nav>
        <div className="space-y-3 border-t p-4">
          <AdminBadge profile={profile} />
          <QuickLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 print:hidden">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={open}
              aria-controls="admin-drawer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon name="menu" />
            </button>
            <Link href="/admin" aria-label="Admin home">
              <BrandLogo showWordmark={false} size={36} />
            </Link>
          </div>

          <p className="hidden text-sm font-semibold text-foreground lg:block">Chapter administration</p>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/member"
              className="hidden h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
            >
              <Icon name="user" className="h-4 w-4" />
              Member portal
            </Link>
            <Link
              href="/"
              className="hidden h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
            >
              <Icon name="globe" className="h-4 w-4" />
              Public site
            </Link>
            <div className="hidden sm:block">
              <AdminBadge profile={profile} compact />
            </div>
            <SignOutButton />
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8 print:p-0">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-sidebar shadow-xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <BrandLogo />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name="close" />
              </button>
            </div>
            <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
              <NavList pathname={pathname} counts={counts} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="space-y-3 border-t p-4">
              <AdminBadge profile={profile} />
              <QuickLinks />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
