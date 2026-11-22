import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <header className="container py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
          >
            PLP
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">PLP Chapter Gisenyi</span>
            <span className="text-xs text-muted-foreground">Peace and Love Proclaimers</span>
          </span>
        </Link>
      </header>

      <main className="container flex flex-1 items-start justify-center pb-12 pt-4 sm:items-center">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
          {children}
        </div>
      </main>

      <footer className="container pb-8 text-center text-xs text-muted-foreground">
        <p>Peace and Love Proclaimers · Gisenyi, Rubavu District, Rwanda</p>
        <p className="mt-1">
          <Link
            href="/"
            className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to the chapter website
          </Link>
        </p>
      </footer>
    </div>
  );
}
