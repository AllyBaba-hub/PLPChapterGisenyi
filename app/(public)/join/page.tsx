import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { JoinForm } from "@/components/public/JoinForm";
import { JoinNotice } from "@/components/public/JoinNotice";
import { PageIntro } from "@/components/public/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { getChapterSettings } from "@/lib/public-data";
import { breadcrumbNode, buildMetadata, jsonLdGraph, organizationNode, pageNode } from "@/lib/seo";

export const revalidate = 300;

const DESCRIPTION =
  "Apply to join PLP Chapter Gisenyi, the Rubavu District chapter of Peace and Love Proclaimers. Apply online, get approved and receive your digital membership card.";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: "Join the chapter", description: DESCRIPTION, path: "/join" });
}

const STEPS = [
  { title: "Apply online", text: "Fill in the form below and create your member account." },
  { title: "Chapter review", text: "Chapter leaders review your application and email you their decision." },
  { title: "Start taking part", text: "Sign in to register for events, read announcements and see your digital membership card." },
] as const;

export default async function JoinPage() {
  const settings = await getChapterSettings();

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationNode(settings),
          pageNode({
            name: `Join ${settings.chapter_name}`,
            description: DESCRIPTION,
            path: "/join",
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Join", path: "/join" },
          ])
        )}
      />

      <PageIntro
        title={`Join ${settings.chapter_name}`}
        description="Become a member of Peace and Love Proclaimers in Gisenyi."
      >
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Join" }]} />
      </PageIntro>

      <div className="container grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_2fr]">
        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-2xl sm:text-2xl">
            How it works
          </h2>
          <ol className="mt-6 space-y-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold tracking-tight sm:text-base">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="apply-heading" className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <h2 id="apply-heading" className="text-2xl sm:text-2xl">
            Membership application
          </h2>
          <div className="mt-4 space-y-6">
            <Suspense fallback={null}>
              <JoinNotice />
            </Suspense>
            <JoinForm applicationsOpen={settings.applications_open} chapterName={settings.chapter_name} />
          </div>
        </section>
      </div>
    </>
  );
}
