import type { Metadata } from "next";
import { AvatarUploader } from "@/components/member/AvatarUploader";
import { PageHeading } from "@/components/member/PageHeading";
import { ProfileForm } from "@/components/member/ProfileForm";
import { getMember } from "@/lib/member-data";

export const metadata: Metadata = { title: "Profile" };

export default async function MemberProfilePage() {
  const { profile } = await getMember();

  return (
    <div className="space-y-8">
      <PageHeading title="Your profile" description="Keep your details up to date so the chapter can reach you." />

      <section aria-labelledby="photo-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="photo-heading" className="mb-4 text-lg sm:text-lg">
          Profile photo
        </h2>
        <AvatarUploader userId={profile.id} fullName={profile.full_name} avatarUrl={profile.avatar_url} />
      </section>

      <section aria-labelledby="details-heading" className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 id="details-heading" className="mb-4 text-lg sm:text-lg">
          Personal details
        </h2>
        <ProfileForm
          email={profile.email}
          initial={{
            full_name: profile.full_name,
            phone: profile.phone ?? "",
            sector_or_cell: profile.sector_or_cell ?? "",
            school_or_occupation: profile.school_or_occupation ?? "",
            bio: profile.bio ?? "",
          }}
        />
      </section>
    </div>
  );
}
