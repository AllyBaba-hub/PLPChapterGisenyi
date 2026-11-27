import type { Metadata } from "next";
import QRCode from "qrcode";
import { MembershipCard } from "@/components/member/MembershipCard";
import { PageHeading } from "@/components/member/PageHeading";
import { PrintCardButton } from "@/components/member/PrintCardButton";
import { getMember } from "@/lib/member-data";
import { getChapterSettings } from "@/lib/public-data";

export const metadata: Metadata = { title: "Membership card" };

export default async function MemberCardPage() {
  const { profile } = await getMember();
  const settings = await getChapterSettings();

  const qrSvg = profile.member_code
    ? await QRCode.toString(profile.member_code, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#0F1729", light: "#FFFFFF" },
      })
    : null;

  return (
    <div>
      <PageHeading
        title="Membership card"
        description="Your official digital PLP Chapter Gisenyi membership card. Show it at chapter activities, or print it."
        actions={<PrintCardButton />}
      />
      <MembershipCard
        profile={profile}
        chapterName={settings.chapter_name}
        parentOrganization={settings.parent_organization}
        qrSvg={qrSvg}
      />
    </div>
  );
}
