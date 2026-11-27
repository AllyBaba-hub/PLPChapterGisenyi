import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ContactForm } from "@/components/public/ContactForm";
import { PageIntro } from "@/components/public/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { getChapterSettings } from "@/lib/public-data";
import { breadcrumbNode, buildMetadata, jsonLdGraph, organizationNode, pageNode } from "@/lib/seo";
import { socialLabel } from "@/lib/utils";

export const revalidate = 300;

const DESCRIPTION =
  "Contact PLP Chapter Gisenyi in Rubavu District, Rwanda. Send a message to chapter leadership about membership, events or partnerships.";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: "Contact", description: DESCRIPTION, path: "/contact" });
}

export default async function ContactPage() {
  const settings = await getChapterSettings();
  const socials = Object.entries(settings.social_links);

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationNode(settings),
          pageNode({
            type: "ContactPage",
            name: `Contact ${settings.chapter_name}`,
            description: DESCRIPTION,
            path: "/contact",
          }),
          breadcrumbNode([
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact" },
          ])
        )}
      />

      <PageIntro title="Contact us" description="Send a message to chapter leadership and we will reply by email.">
        <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Contact" }]} />
      </PageIntro>

      <div className="container grid gap-10 py-12 sm:py-16 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="message-heading" className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <h2 id="message-heading" className="text-2xl sm:text-2xl">
            Send a message
          </h2>
          <div className="mt-6">
            <ContactForm />
          </div>
        </section>

        <aside aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-2xl sm:text-2xl">
            Chapter details
          </h2>
          <address className="mt-6 space-y-4 text-sm not-italic">
            <div>
              <p className="font-semibold">Location</p>
              <p className="text-muted-foreground">{settings.district_location}</p>
            </div>
            <div>
              <p className="font-semibold">Email</p>
              <a
                href={`mailto:${settings.contact_email}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {settings.contact_email}
              </a>
            </div>
            {settings.contact_phone ? (
              <div>
                <p className="font-semibold">Phone</p>
                <a
                  href={`tel:${settings.contact_phone.replace(/[^+\d]/g, "")}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {settings.contact_phone}
                </a>
              </div>
            ) : null}
            {socials.length > 0 ? (
              <div>
                <p className="font-semibold">Follow us</p>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {socials.map(([key, url]) => (
                    <li key={key}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer me"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {socialLabel(key)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </address>
        </aside>
      </div>
    </>
  );
}
