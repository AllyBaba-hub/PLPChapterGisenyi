import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Choose a new password",
    description: "Set a new password for your PLP Chapter Gisenyi member account.",
    alternates: { canonical: "/reset-password" },
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
