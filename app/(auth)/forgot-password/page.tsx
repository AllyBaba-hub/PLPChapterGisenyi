import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Reset your password",
    description:
      "Request a password reset link for your PLP Chapter Gisenyi member account.",
    alternates: { canonical: "/forgot-password" },
    robots: { index: false, follow: false },
  };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
